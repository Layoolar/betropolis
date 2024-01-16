/**
 * Database: lowdb
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */
import type { TelegramUserInterface } from "@app/types/databases.type";
import configs from "@configs/config";
import lowdb from "lowdb";
import lowdbFileSync from "lowdb/adapters/FileSync";
import { BetData, CoinDataType } from "./commands";
import fetchData from "./fetchCoins";
//onst ChartJsImage = require("chartjs-to-image");
import ChartJsImage from "chartjs-to-image";

interface MyUser extends TelegramUserInterface {
	walletAddress: string | null;
	bets: BetData[] | [];
}

interface CoinData {
	token: string;
	time: number;
	price: number;
	network: string;
	name: string;
	symbol: string;
	marketCap: number;
}

export interface CoinDataCollection {
	id: string;
	coindata: CoinData[];
	topTenStatus: boolean;
}

const databases = {
	users: lowdb(new lowdbFileSync<{ users: MyUser[] }>(configs.databases.users)),
	ethCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.ethCoinsData)),
	solCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.solCoinsData)),
	bnbCoinsData: lowdb(new lowdbFileSync<{ coinsData: CoinDataCollection[] }>(configs.databases.bnbCoinsData)),
};

databases.ethCoinsData = lowdb(new lowdbFileSync(configs.databases.ethCoinsData));
databases.ethCoinsData.defaults({ coinsData: [] }).write();

databases.solCoinsData = lowdb(new lowdbFileSync(configs.databases.solCoinsData));
databases.solCoinsData.defaults({ coinsData: [] }).write();

databases.bnbCoinsData = lowdb(new lowdbFileSync(configs.databases.bnbCoinsData));
databases.bnbCoinsData.defaults({ coinsData: [] }).write();

databases.users = lowdb(new lowdbFileSync(configs.databases.users));
databases.users.defaults({ users: [] }).write();

/**
 * writeUser()
 * =====================
 * Write user information from telegram context to user database
 *
 * @Context: ctx.update.message.from
 *
 * @interface [TelegramUserInterface](https://github.com/ptkdev-boilerplate/node-telegram-bot-boilerplate/blob/main/app/webcomponent/types/databases.type.ts)
 *
 * @param { TelegramUserInterface } json - telegram user object
 *
 */
const writeUser = async (json: MyUser): Promise<void> => {
	const user_id = databases.users.get("users").find({ id: json.id }).value();

	if (user_id) {
		databases.users.get("users").find({ id: user_id.id }).assign(json).write();
	} else {
		databases.users.get("users").push(json).write();
	}
};
const checkUserExists = (userId: number): boolean => {
	const userInDb = databases.users.get("users").find({ id: userId }).value();
	return !!userInDb;
};

const updateWallet = (userId: number, newWallet: string): boolean => {
	const userInDb = databases.users.get("users").find({ id: userId });

	if (userInDb.value()) {
		userInDb.assign({ walletAddress: newWallet }).write();
		return true;
	} else return false;
};
const isWalletNotNull = (userId: number): boolean => {
	const userInDb = databases.users.get("users").find({ id: userId }).value();
	return !!userInDb && userInDb.walletAddress !== null;
};

const saveBet = (userId: number, betData: BetData) => {
	const userInDb = databases.users.get("users").find({ id: userId });

	if (userInDb.value()) {
		userInDb.assign({ bets: [...userInDb.value().bets, betData] }).write();
		return true;
	} else return false;
};

const updateBetStatus = (userId: number, betData: BetData, price: number, verdict: string) => {
	console.log("updating");
	const userInDb = databases.users.get("users").find({ id: userId });
	const existingBets = userInDb.value().bets;

	const betIndexToUpdate = existingBets.findIndex((existingBet) => existingBet.betId === betData.betId);

	console.log(verdict);
	if (betIndexToUpdate !== -1) {
		// Update the existing bet with the new data
		existingBets[betIndexToUpdate] = {
			...existingBets[betIndexToUpdate],
			status: "closed",
			priceAtEndOfBet: price,
			betVerdict: verdict,
		};
	}

	userInDb.assign({ bets: existingBets }).write();

	return true;
};

function getBetsFromDb(userId: number) {
	const user = databases.users.get("users").find({ id: userId }).value();

	if (user) {
		return user.bets || [];
	} else {
		return [];
	}
}

const addCoinData = (incomingCoinData: CoinDataCollection, db: string) => {
	console.log("addcoindata");
	// @ts-ignore
	databases[db].get("coinsData").push(incomingCoinData).write();
};

const updateCoinData = (incomingCoinData: CoinDataCollection, db: string) => {
	return new Promise<void>((resolve) => {
		const coinId = incomingCoinData.id;
		// @ts-ignore
		const existingCoinIndex = databases[db].get("coinsData").findIndex({ id: coinId }).value();

		if (existingCoinIndex !== -1) {
			//@ts-ignore
			const existingCoin = { ...databases[db].get("coinsData").find({ id: coinId }).value() };

			// Push the incoming coindata to the existing coindata array
			existingCoin.coindata.push(...incomingCoinData.coindata);
			existingCoin.topTenStatus = true;

			// Update the existing coinData in the database
			// @ts-ignore
			databases[db].get("coinsData").find({ id: coinId }).assign(existingCoin).write();

			//console.log(`CoinData with ID ${coinId} updated successfully.`);
		} else {
			// If the coinData doesn't exist, add a new entry
			addCoinData(incomingCoinData, db);
			//	console.log(`CoinData with ID ${coinId} added successfully.`);
		}

		resolve();
	});
};

const updateDbWithTopTen = async (network: string, db: string) => {
	const result = await fetchData(network, null);

	const data = result.data as CoinDataType[];
	// @ts-ignore
	databases[db]
		.get("coinsData")
		.each((coin: CoinDataCollection) => {
			coin.topTenStatus = false;
		})
		.write();

	for (const coin of data) {
		const incomingCoin: CoinDataCollection = {
			id: coin.token,
			topTenStatus: true,
			coindata: [
				{
					name: coin.tokenData.name,
					network: coin.network,
					price: coin.price,
					symbol: coin.tokenData.symbol,
					time: 0,
					token: coin.token,
					marketCap: coin.liquidity,
				},
			],
		};

		await updateCoinData(incomingCoin, db);
	}

	// @ts-ignore
	databases[db].get("coinsData").remove({ topTenStatus: false }).write();
};

// setInterval(async () => await updateDbWithTopTen("ethereum", "ethCoinsData"), 5000);
// setInterval(async () => await updateDbWithTopTen("solana", "solCoinsData"), 5000);
// setInterval(async () => await updateDbWithTopTen("bsc", "bnbCoinsData"), 5000);

function extractTimeAndPrice(data: { price: number; marketCap: number }[]) {
	let priceArray = data.map((item) => item.price);
	let marketCapArray = data.map((item) => item.marketCap);
	if (priceArray.length < 6) {
		for (let i = 0; i < 6 - priceArray.length; i++) {
			priceArray = [0, ...priceArray];
		}
	}

	if (marketCapArray.length < 6) {
		for (let i = 0; i < 6 - marketCapArray.length; i++) {
			marketCapArray = [0, ...marketCapArray];
		}
	}

	return { priceArray, marketCapArray };
}

const getHistoricalDataAndGraph = async (tokenName: string, chain: string) => {
	const tokens: { data: CoinDataType[] } = await fetchData(chain, null);
	let db: string;

	let priceHistoricalData: { time: number; price: number; name: string; marketCap: number }[] = [];
	// console.log(tokens);
	const token = tokens.data.filter((item) => item.tokenData.name === tokenName);

	if (chain === "ethereum") {
		db = "ethCoinsData";
	} else if (chain === "bnb") {
		db = "bnbCoinsData";
	} else {
		db = "solCoinsData";
	}
	if (token.length === 0) {
		return null;
	}

	//@ts-ignore
	const historical = databases[db].get("coinsData").find({ id: token[0].token });

	if (historical.value() === undefined) {
		return null;
	}
	//console.log(historical.value());
	//const userInDb = databases.users.get("users").find({ id: userId });

	for (let index = 0; index < historical.value().coindata.length; index++) {
		const element = historical.value().coindata[index];
		priceHistoricalData.push({
			time: (index + 1) * 5,
			price: element.price,
			name: element.name,
			marketCap: element.marketCap,
		});
	}

	const { priceArray, marketCapArray } = extractTimeAndPrice(priceHistoricalData);
	console.log(priceArray);
	const myPriceChart = new ChartJsImage();
	myPriceChart.setConfig({
		type: "line",
		data: {
			labels: [0, 5, 10, 15, 20, 25],
			datasets: [{ label: "Coin price", data: priceArray.slice(-6) }],
		},
	});
	const myMcapChart = new ChartJsImage();
	myMcapChart.setConfig({
		type: "line",
		data: {
			labels: [0, 5, 10, 15, 20, 25],
			datasets: [{ label: "Market cap", data: marketCapArray.slice(-6) }],
		},
	});
	//console.log(myChart.getUrl());

	const buf = await myPriceChart.toBinary();
	const capBuf = await myMcapChart.toBinary();
	return { priceChartBuffer: buf, marketCapChartBuffer: capBuf, priceHistoricalData: priceHistoricalData };
};

const openaiApiKey = "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";

// fetch("https://api.openai.com/v1/chat/completions", {
// 	method: "POST",
// 	headers: {
// 		"Content-Type": "application/json",
// 		Authorization: `Bearer ${openaiApiKey}`,
// 	},
// 	body: JSON.stringify({
// 		model: "gpt-3.5-turbo",
// 		messages: [
// 			{
// 				role: "user",
// 				content: ` if i give you data can you analyse the data and mention if there is a common market trend that can give informartion in buy or sell. this is an array of price
// 					[
//   0,
//   0.14991464554707615,
//   0.14991464554707615,
//   0.14991464554707615,
//   0.14991464554707615
// ]in the last 30 mins `,
// 			},
// 		],
// 		temperature: 0.7,
// 	}),
// })
// 	.then((response) => response.json())
// 	.then((data) => console.log(data.choices[0].message))
// 	.catch((error) => console.error("Error:", error));

// analyse the data and mention if there is a common market trend that can give informartion in buy or sell.

export {
	databases,
	writeUser,
	checkUserExists,
	updateWallet,
	isWalletNotNull,
	saveBet,
	updateBetStatus,
	getHistoricalDataAndGraph,
	getBetsFromDb,
};
export default databases;
