/**
 * Telegraf Commands
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */

import bot from "@app/functions/telegraf";
import { Markup, MiddlewareFn, Context } from "telegraf";
import * as databases from "@app/functions/databases";
import config from "@configs/config";
import { launchPolling, launchWebhook } from "./launcher";
import fetchData, { fetchCoin, formatCoinsMessage, sendAllChainData } from "./fetchCoins";
import { v4 as uuidv4 } from "uuid";
import { queryAi } from "./queryApi";

// interface coins extends CoinDataType{

// }
export interface CoinDataType {
	token: string;
	rank: number;
	rankTrade24h: number;
	rankView: number;
	rankVolume24h: number;
	price: number;
	priceChange24hPercent: number;
	volume24h: number;
	volume24hChangePercent: number;
	view24h: number;
	view24hChangePercent: number | null;
	liquidity: number;
	network: string;
	tokenData: {
		name: string;
		symbol: string;
		decimals: number;
		icon: string;
		website: string;
	};
}
// interface BettingCoinData extends CoinDataType {
// 	position: number;
// }
export type BetData = {
	betId: string;
	name: string;
	token: string;
	symbol: string;
	priceAtStartOfBet: number;
	priceAtEndOfBet: undefined | number;
	network: string;
	direction: string;
	status: "open" | "closed";
	betVerdict: string;
};

// type CoinData = {
// 	id: string;
// 	time: number;
// 	price: number;
// 	network: string;
// 	name: string;
// 	symbol: string;
// };

const promptText = `
I just created a key-value pair object:

\`\`\`javascript
{
  trade: [trades, \${address of token to buy}, \${value of the token to buy}],
  enquiries: [enquiries, \${chain}, \${contract address}],
  others: null
}
\`\`\`
Read the data after the object and reply strictly in the following format based on the intention of the message:

If the intention is to buy a token, reply with "trades, [the token address the user wants to buy], [how much he wants to buy]".
Remember, reply exactly in that format, substituting the appropriate values. Do not add a space after the comma.

Now analyze the content below and reply accordingly:
`;

let chatId: number;
const aiPromptText = `\{trade: trades,\${address of token to buy},\${value of the token to buy}
							 enquiries:enquiries,\${chain},\${contract address} 
							 others: null } 
							 I just created a key value pair above. 
						Read the data after the object and reply with strictly that format the intention of the
						message. If the intention is to buy a token, reply with \"trades, the toke address the user wants
						to buy, how much he wants to buy\". Just like the object above, reply exactly in that format. 
						I've provided a key value pair object above. Once you notice the intetion matches, 
						reply in the format of the value while substituting the appropriate values in. 
					Remember, only in that format dont add a space after the comma. So, here's the content you are analysing below: `;

const analysisPrompt = `Below are the values of a token prices in the Las 30 minutes... Identify market trends or indicators and use that data to predict maybe the token will go up or down...


You must choose out of up or down and give reason

 this is the data const dataObject = {
  price: [73.48, 28.59, 11.71, 95.41, 42.57],
  time: [0, 5, 10, 15, 20, 25],
};`;

const buttons = Markup.inlineKeyboard([
	// [Markup.button.callback("Today's posts", "todays_post"), Markup.button.callback("My points", "points")],
	[Markup.button.callback("How to bet", "bet")],
	[Markup.button.callback("Submit wallet", "wallet")],
	[Markup.button.callback("Top ethereum Coins", "eth")],
	[Markup.button.callback("Top solana Coins", "sol")],
	[Markup.button.callback("Top bnb Coins", "bnb")],
]);

function getGreeting() {
	const now = new Date();
	const hours = now.getHours();

	if (hours >= 5 && hours < 12) {
		return "Good morning";
	} else if (hours >= 12 && hours < 18) {
		return "Good afternoon";
	} else {
		return "Good evening";
	}
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendHourlyMessage() {
	const ethdata = await fetchData("ethereum", null);
	const soldata = await fetchData("solana", null);
	const bnbdata = await fetchData("bnb", null);

	bot.telegram.sendMessage(chatId, formatCoinsMessage(ethdata, null));
	bot.telegram.sendMessage(chatId, formatCoinsMessage(soldata, null));
	bot.telegram.sendMessage(chatId, formatCoinsMessage(bnbdata, null));
}

// setInterval(sendHourlyMessage, 3000);
// setInterval(() => console.log("hi"), 3000);

const isValidWallet = (address: string): boolean => {
	// ctx.reply;
	const ethAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;

	const isValidAddress = ethAddressRegex.test(address);

	if (isValidAddress) {
		return true;
	} else {
		return false;
	}
};

const checkGroup: MiddlewareFn<Context> = (ctx, next) => {
	const chatType = ctx.chat?.type;

	if (chatType === "group") {
		ctx.reply("This command cannot be used in groups");
	} else {
		next();
	}
};
// "/submitWallet":  'Send a DM with the command "/submitwallet -your wallet address-" to submit your wallet',

const commands = {
	"/start": "Use this command to register and get started",
	"/wallet": "use this command to check details on how to submit your wallet ",
	"/eth": "Fetch the top 10 trending tokens on the Ethereum chain",
	"/sol": "Fetch the top 10 trending tokens on the Solana chain",
	"/bnb": "Fetch the top 10 trending tokens on the BNB chain",
	"/placebet": "Use this to place a bet",
	"/getalltokens": "Fetch the top 10 trending tokens on all supported chains",
	"/mybets": "Get a list of all your bets",
	"/myopenbets": "Get a list of all your open bets",
};

bot.help((ctx) => {
	const commandsList = Object.entries(commands)
		.map(([command, description]) => `${command}: ${description}`)
		.join("\n\n");

	ctx.reply(`Here are some available commands:\n\n${commandsList}`);
});

const prompt = () => {
	bot.command("/prompt", async (ctx) => {
		const commandArgs = ctx.message.text.split(" ").slice(1);

		const prompt = commandArgs.join(" ");
		const response = await queryAi(aiPromptText + prompt);

		if (response.toLowerCase() === "null") return ctx.reply("Please clarify your request or enquiry");
		console.log(response);
		const responseArray = response.split(",");
		//first item is type of request
		console.log(responseArray[0]);
		if (responseArray[0].toLowerCase() === "enquiries") {
			console;
			const coinData = await fetchCoin(responseArray[2], responseArray[1]);
			const coinDataJson = JSON.stringify(coinData);
			console.log(coinData);

			const summary = await queryAi(
				`Summarize the data contained in this ${coinDataJson} make it conversational 
				using the name address price liquidity marketcap, do not add anything in the text referring
				 to the json object or the data provided just make it seem normal.`,
			);
			console.log(summary);
			ctx.reply(summary);
		} else if (responseArray[0].toLowerCase() === "trades") {
			const States = {
				START_TRADING: "start_trading",
				CONFIRM_COIN: "confirm_coin",
			};
			let state = States.START_TRADING;

			const worth = responseArray[2];
			const contractAddress = responseArray[1];

			const coin = await fetchCoin(responseArray[1], "ethereum");

			const actions = ["Confirm", "Cancel"];

			const buttons = actions.map((action: string) => [Markup.button.callback(`${action}`, `action_${action}`)]);
			const keyboard = Markup.inlineKeyboard(buttons);

			state = States.CONFIRM_COIN;
			ctx.reply(`Are you sure you want to trade \$${worth} worth of ${contractAddress} (${coin.name})`, keyboard);

			bot.action(/action_(.+)/, async (ctx) => {
				const action = ctx.match[1];
				if (state !== States.CONFIRM_COIN) {
					return ctx.reply("You have selected your option, use the prompt to start another trade");
				}
				state = States.START_TRADING;
				if (action.toLowerCase() === "confirm") {
					console.log(action);
				} else {
					return ctx.reply("Trade has been cancelled");
				}
			});
		}
	});
};

const coinActions = () => {
	bot.command("/wallet", (ctx) => {
		ctx.reply(`${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name} send a dm with the command
	 "/submitwallet -your wallet address-" to submit your wallet`);
	});
	bot.command("/eth", async (ctx) => {
		// fetchCoins("ethereum", null, ctx);

		const data = await fetchData("ethereum", null);
		ctx.reply(formatCoinsMessage(data, null));
	});

	bot.command("/sol", async (ctx) => {
		// fetchCoins("solana", null, ctx);
		const data = await fetchData("solana", null);
		ctx.reply(formatCoinsMessage(data, null));
	});

	bot.command("/bnb", async (ctx) => {
		// fetchCoins("bnb", null, ctx);
		const data = await fetchData("bsc", null);
		ctx.reply(formatCoinsMessage(data, null));
	});

	bot.command("/bet", (ctx) =>
		ctx.reply(
			'Use the menu to check list of coins avaliable for betting and send the command "/placebet  -coin name-  -direction(up, down or same)-" ',
		),
	);

	bot.command("/getalltokens", async (ctx) => {
		sendAllChainData(ctx);
	});

	// const commandArgs = ctx.message.text.split(" ").slice(1, 3);

	// const coinSymbol = commandArgs[0];
	// const chain = commandArgs[1];
	bot.command("/analysis", async (ctx) => {
		// const States = {
		// 	CHOOSE_CHAIN: "choose_chain",
		// 	CHOOSE_COIN: "choose_coin",
		// };

		// let state=States.CHOOSE_CHAIN
		const chains = ["Ethereum", "Solana", "Bnb"];

		const cancelButton = [Markup.button.callback(`Cancel`, `cancel`)];
		const buttons = chains.map((chain) => [Markup.button.callback(`${chain}`, `chain_${chain}`)]);
		const keyboard = Markup.inlineKeyboard(buttons);
		ctx.reply("Choose a chain", keyboard);
		//	ctx.reply("Press this button to cancel", Markup.inlineKeyboard(cancelButton));

		bot.action(/chain_(.+)/, async (ctx) => {
			// if(state!=States.CHOOSE_CHAIN){

			// 	ctx.reply("You have selected a chain please cancel/complete the current process")
			// }
			const chain = ctx.match[1];

			const coinData = await fetchData(chain.toLowerCase(), null);
			const coins = coinData.data.map((coin: any) => `${coin.tokenData.name}`);
			const buttons = coins.map((coin: any) => [Markup.button.callback(`${coin}`, `coin_${coin}`)]);
			const keyboard = Markup.inlineKeyboard(buttons);
			ctx.reply(`These are the coins available for analysis on the ${chain} chain`, keyboard);
			//ctx.reply("Press this button to cancel", Markup.inlineKeyboard(cancelButton));
			bot.action(/coin_(.+)/, async (ctx) => {
				const coin = ctx.match[1];
				const response = await databases.getHistoricalDataAndGraph(coin, chain.toLowerCase());

				if (response?.priceChartBuffer && response.priceHistoricalData && response.marketCapChartBuffer) {
					ctx.reply(`These are the charts for the price and market cap of ${response.priceHistoricalData[0].name} in the last 30 minutes or lesser based on how
 long it has spent in the top 10, the data points are in 5 minute intervals`);

					ctx.replyWithPhoto(
						{ source: response.priceChartBuffer },
						{ caption: `This is the price chart of ${response.priceHistoricalData[0].name}` },
					);

					ctx.replyWithPhoto(
						{ source: response.marketCapChartBuffer },
						{ caption: `This is the market cap chart data for ${response.priceHistoricalData[0].name}` },
					);
				} else {
					ctx.reply("data is unavailable for this token");
				}
			});
		});
	});
};

// const response = await databases.getHistoricalDataAndGraph(coinSymbol, chain);

// if (response?.chartBuffer && response.priceHistoricalData) {
// 	ctx.replyWithPhoto(
// 		{ source: response.chartBuffer },
// 		{ caption: `This is the chart data for ${response.priceHistoricalData[0].name} (${coinSymbol}) ` },
// 	);
// } else {
// 	ctx.reply("The token requested is not valid, check trending tokens and try again");
// }

/**
 * command: /quit
 * =====================
 * If user exit from bot
 *
 */

const quit = async (): Promise<void> => {
	bot.command("quit", (ctx) => {
		ctx.telegram.leaveChat(ctx.message.chat.id);
		ctx.leaveChat();
	});
};

/**
 * command: /start
 * =====================
 * Send welcome message
 *
 */
// const menu = async (): Promise<void> => {
// 	bot.command("menu", (ctx) => {
// 		chatId = ctx.message.chat.id;
// 		ctx.telegram.sendMessage(
// 			ctx.message.chat.id,
// 			`${getGreeting()} ${ctx.from?.username || ctx.from?.first_name || ctx.from?.last_name}`,
// 			{
// 				reply_markup: buttons.reply_markup,
// 				parse_mode: "HTML",
// 			},
// 		);
// 	});
// };

const start = async (): Promise<void> => {
	bot.start((ctx) => {
		databases.writeUser({ ...ctx.update.message.from, walletAddress: null, bets: [] });

		chatId = ctx.message.chat.id;
		ctx.telegram.sendMessage(
			ctx.message.chat.id,
			`Welcome you have been sucessfully registered use /help to check the list of commands`,
		);
	});
};

const placeBet = async (): Promise<void> => {
	bot.command("/placebet", checkGroup, async (ctx) => {
		if (!databases.checkUserExists(ctx.from.id)) {
			return ctx.reply("You are not yet registered, send /start command to get started and register.");
		}

		if (!databases.isWalletNotNull(ctx.from.id)) {
			return ctx.reply("You have not added a wallet yet, send /wallet to check how.");
		}

		const States = {
			CHOOSE_CHAIN: "choose_chain",
			CHOOSE_COIN: "choose_coin",
			CHOOSE_DIRECTION: "choose_direction",
			BET_PLACED: "bet_placed",
		};

		let betcoin: CoinDataType | null = null;
		let betPlaced: BetData | null = null;
		const bettor = ctx.message.from;

		const chains = ["Ethereum", "Solana", "Bnb"];
		const buttons = chains.map((chain) => [Markup.button.callback(`${chain}`, `chain_${chain}`)]);
		const keyboard = Markup.inlineKeyboard(buttons);
		let currentState = States.CHOOSE_CHAIN;
		await ctx.reply("Choose a chain to bet on", keyboard);

		const cancelButton = [Markup.button.callback("Cancel", "cancelbet")];

		ctx.reply("Use the button below to cancel the bet process", Markup.inlineKeyboard(cancelButton));

		bot.action("cancelbet", (ctx) => {
			currentState = States.CHOOSE_CHAIN;
			return ctx.reply("Bet Process has been cancelled. use /placebet to restart");
		});
		bot.action(/chain_(.+)/, async (ctx) => {
			if (currentState !== States.CHOOSE_CHAIN) {
				return ctx.reply(
					"Invalid action at this point. If you want to go back use the cancel bet button to cancel current bet process and restart",
				);
			}
			const chain = ctx.match[1];

			const coinData = await fetchData(chain.toLowerCase(), "bet");
			const coins = coinData.data.map((coin: any) => `${coin.tokenData.name}`);
			const buttons = coins.map((coin: any) => [Markup.button.callback(`${coin}`, `coin_${coin}`)]);
			const keyboard = Markup.inlineKeyboard(buttons);
			currentState = States.CHOOSE_COIN;
			await ctx.reply(`These are the coins available to bet on the ${chain} chain`, keyboard);
			ctx.reply("Use the button below to cancel the bet process", Markup.inlineKeyboard(cancelButton));

			bot.action(/coin_(.+)/, async (ctx) => {
				if (currentState !== States.CHOOSE_COIN) {
					return ctx.reply(
						"Invalid action at this point. If you want to go back use the cancel bet button to cancel current bet process and restart",
					);
				}
				const coin = ctx.match[1];
				// ctx.reply(`You selected ${coin}`);

				for (let index = 0; index < coinData.data.length; index++) {
					const element = coinData.data[index];
					if (element.tokenData.name === coin) {
						betcoin = { ...element };
					} else {
						continue;
					}
				}

				if (betcoin) {
					const directions = ["Up", "Same", "Down"];

					//
					const buttons = directions.map((direction) => [
						Markup.button.callback(`${direction}`, `direction_${direction}`),
					]);
					const keyboard = Markup.inlineKeyboard(buttons);

					currentState = States.CHOOSE_DIRECTION;
					await ctx.reply("Choose a direction", keyboard);
					ctx.reply("Use the button below to cancel the bet process", Markup.inlineKeyboard(cancelButton));

					bot.action(/direction_(.+)/, async (ctx) => {
						if (currentState !== States.CHOOSE_DIRECTION) {
							return ctx.reply(
								"Invalid action at this point. If you want to go back use the cancel bet button to cancel current bet process and restart",
							);
						}
						const direction = ctx.match[1];

						if (betcoin) {
							betPlaced = {
								name: betcoin.tokenData.name,
								betId: uuidv4(),
								token: betcoin.token,
								symbol: betcoin.tokenData.symbol,
								network: betcoin.network,
								priceAtStartOfBet: betcoin.price,
								priceAtEndOfBet: undefined,
								status: "open",
								direction: direction.toLowerCase(),
								betVerdict: "unresolved",
							};
						}
						if (betPlaced) {
							databases.saveBet(bettor.id, betPlaced);
						}

						currentState = States.BET_PLACED;
						await ctx.reply(
							`you have placed a bet on ${betPlaced?.name} and the direction is ${betPlaced?.direction}`,
						);

						// 	//await delay(1800000);

						if (betPlaced) {
							const dataAfterbet = await fetchCoin(betPlaced.token, betPlaced.network);

							// return;
							if (dataAfterbet.price < betPlaced.priceAtStartOfBet && betPlaced.direction === "down") {
								//console.log(betPlaced.direction);
								databases.updateBetStatus(bettor.id, betPlaced, dataAfterbet.price, "won");
								databases.updateLeaderboard();
								return ctx.reply(
									`${bettor.first_name || bettor.username} your bet on ${betPlaced.name} was won `,
								);
							} else if (
								dataAfterbet.price > betPlaced.priceAtStartOfBet &&
								betPlaced.direction === "up"
							) {
								//console.log(betPlaced.direction);
								databases.updateBetStatus(bettor.id, betPlaced, dataAfterbet.price, "won");
								databases.updateLeaderboard();
								return ctx.reply(
									`${bettor.first_name || bettor.username} your bet on ${betPlaced.name} was won `,
								);
							} else if (
								dataAfterbet.price === betPlaced.priceAtStartOfBet &&
								betPlaced.direction == "same"
							) {
								databases.updateLeaderboard();
								//console.log(betPlaced.direction);
								databases.updateBetStatus(bettor.id, betPlaced, dataAfterbet.price, "won");
								return ctx.reply(
									`${bettor.username || bettor.first_name} your bet on ${betPlaced.name} was won `,
								);
							} else {
								databases.updateBetStatus(bettor.id, betPlaced, dataAfterbet.price, "lost");
								databases.updateLeaderboard();
								return ctx.reply(
									`${bettor.username || bettor.first_name} your bet on ${betPlaced.name} was lost `,
								);
							}
						}
					});
				}
			});
		});

		// 	//await delay(1800000);

		// }

		// lineeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee

		// Set up the inline keyboard with dynamic buttons

		// const bettor = ctx.message.from;

		// const commandArgs = ctx.message.text.split(" ").slice(1, 3);

		// const coinSymbol = commandArgs[0];
		// const direction = commandArgs[1];

		// console.log(commandArgs);

		// let betcoin: BettingCoinData | null = null;
		// const ethData = await fetchData("ethereum", "bet");
		// const bnbData = await fetchData("bnb", "bet");
		// const solData = await fetchData("solana", "bet");

		// for (let index = 0; index < ethData.data.length; index++) {
		// 	const element = ethData.data[index];
		// 	console.log(element.tokenData.symbol);
		// 	console.log(coinSymbol);
		// 	if (element.tokenData.symbol === coinSymbol) {
		// 		betcoin = { ...element, position: index + 3 };
		// 	} else {
		// 		continue;
		// 	}
		// }

		// for (let index = 0; index < solData.data.length; index++) {
		// 	const element = solData.data[index];
		// 	if (element.tokenData.symbol === coinSymbol) {
		// 		betcoin = { ...element, position: index + 3 };
		// 	} else {
		// 		continue;
		// 	}
		// }
		// for (let index = 0; index < bnbData.data.length; index++) {
		// 	const element = bnbData.data[index];
		// 	if (element.tokenData.symbol === coinSymbol) {
		// 		betcoin = { ...element, position: index + 3 };
		// 	} else {
		// 		continue;
		// 	}
		// }

		// console.log(betcoin);
		// if (betcoin) {
		// 	const betPlaced: BetData = {
		// 		name: betcoin.tokenData.name,
		// 		token: betcoin.token,
		// 		symbol: betcoin.tokenData.symbol,
		// 		network: betcoin.network,
		// 		positionAtStartOfBet: betcoin.position,
		// 		positionAtEndOfBet: undefined,
		// 		status: "open",
		// 		direction: direction,
		// 	};

		// 	databases.saveBet(bettor.id, betPlaced);
		// 	ctx.reply(`Your bet on ${betcoin.tokenData.name} has been placed\n direction is ${direction}`);

		// 	//await delay(1800000);

		// 	const dataAfterbet = await fetchData(betPlaced.network, null);

		// 	for (let index = 0; index < dataAfterbet.data.length; index++) {
		// 		const element = dataAfterbet.data[index];
		// 		if (element.token === betPlaced.token) {
		// 			console.log(betPlaced.positionAtStartOfBet);
		// 			console.log(index + 1);
		// 			if (index + 1 > betPlaced.positionAtStartOfBet && betPlaced.direction === "down") {
		// 				databases.updateBetStatus(bettor.id, betPlaced, index + 1);
		// 				return ctx.reply(
		// 					`${bettor.first_name || bettor.username} your bet on ${betPlaced.name} was won `,
		// 				);
		// 			} else if (index + 1 < betPlaced.positionAtStartOfBet && betPlaced.direction === "up") {
		// 				databases.updateBetStatus(bettor.id, betPlaced, index + 1);
		// 				return ctx.reply(
		// 					`${bettor.first_name || bettor.username} your bet on ${betPlaced.name} was won `,
		// 				);
		// 			} else if (index + 1 === betPlaced.positionAtStartOfBet && betPlaced.direction === "same") {
		// 				databases.updateBetStatus(bettor.id, betPlaced, index + 1);
		// 				return ctx.reply(
		// 					`${bettor.username || bettor.first_name} your bet on ${betPlaced.name} was won `,
		// 				);
		// 			}
		// 		} else {
		// 			continue;
		// 		}
		// 	}

		// 	if (betPlaced.direction === "down") {
		// 		databases.updateBetStatus(bettor.id, betPlaced, "Not in top 10");
		// 		return ctx.reply(`${bettor.username || bettor.first_name} your bet on ${betPlaced.name} was won `);
		// 	}
		// 	databases.updateBetStatus(bettor.id, betPlaced, "Not in top 10");
		// 	return ctx.reply(`${bettor.username || bettor.first_name} your bet on ${betPlaced.name} was lost `);
		// } else {
		// 	return ctx.reply(
		// 		"Coin details provided for the bet are not valid, please check the trending tokens or tokens available for betting you can use /getalltokens to check and try again",
		// 	);
		// }
	});
};

const getBet = () => {
	bot.command("/mybets", (ctx) => {
		const bets = databases.getBetsFromDb(ctx.from.id);
		if (bets.length === 0) {
			return ctx.reply("You have no bets yet use /placebet to place a bet");
		}

		for (let index = 0; index < bets.length; index++) {
			const element = bets[index];

			ctx.reply(
				`you ${element.status === "open" ? "have" : "placed"} a bet on ${element.name} to go ${
					element.direction
				} ${element.status === "open" ? "" : `and it was ${element.betVerdict}`} `,
			);
		}
	});

	bot.command("/myopenbets", (ctx) => {
		const openBets = databases.getBetsFromDb(ctx.from.id).filter((bets) => bets.status === "open");
		if (openBets.length === 0) {
			return ctx.reply("You have no open bets");
		}

		for (let index = 0; index < openBets.length; index++) {
			const element = openBets[index];
			ctx.reply(`you have a bet on ${element.name} to go ${element.direction}`);
		}
	});
};

// const analyse = () => {
// 	bot.command("analyze", async (ctx) => {
// 		const inputArray = ctx.message.text.split(" ");
// 		const coinRequested = inputArray.slice(1).join(" ");
// 	});
// };

const submitWallet = async (): Promise<void> => {
	bot.command("submitwallet", checkGroup, async (ctx) => {
		if (!databases.checkUserExists(ctx.from.id)) {
			return ctx.reply("you are not yet registered, send /start command to get started");
		}
		const inputArray = ctx.message.text.split(" ");
		const commandText = inputArray.slice(1).join(" ");

		if (commandText) {
			if (isValidWallet(commandText)) {
				// save wallet to db
				if (databases.updateWallet(ctx.from.id, commandText)) {
					return ctx.reply("wallet submitted successfully");
				}
			} else {
				return ctx.reply("invalid wallet address");
			}
		} else {
			return ctx.reply(" Add your wallet address to the command");
		}
	});
};

const leaderBoard = async (): Promise<void> => {
	bot.command("leaderboard", (ctx) => {
		console.log("hi");
		const leaderboard = databases.getLeaderboard();

		return ctx.reply(`These are the Players on the leader board\n\n ${leaderboard.join("\n")}`);
	});
};

/**
 * Run bot
 * =====================
 * Send welcome message
 *
 */
const launch = async (): Promise<void> => {
	const mode = config.mode;
	if (mode === "webhook") {
		launchWebhook();
	} else {
		launchPolling();
	}
};

export { launch, quit, start, submitWallet, placeBet, coinActions, getBet, leaderBoard, prompt };
export default launch;
