import { Context } from "telegraf";
import { CoinDataType } from "./commands";
import axios from "axios";

const fetchData = async (network: string, bet: "bet" | null): Promise<{ data: CoinDataType[] }> => {
	const url = `https://multichain-api.birdeye.so/${network}/trending/token?u=da39a3ee5e6b4b0d3255bfef95601890afd80709`;

	const headers = new Headers({
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
		//Accept: "application/json, text/plain, /",
		"Accept-Language": "en-US,en;q=0.5",
		token: "undefined",
		"agent-id": "f28a43fd-cb0e-4dad-a4eb-b28e8f3805b5",
		Origin: "https://birdeye.so",
		Referer: "https://birdeye.so/",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
	});

	try {
		const response = await fetch(url, { method: "GET", headers: headers });
		console.log(response);
		const result = await response.json();

		if (bet) {
			// Return only elements on indexes 2 to 6
			result.data = result.data.slice(2, 7);
		}

		return result as { data: CoinDataType[] };
	} catch (error) {
		console.error("Error:", error);
		throw error; // Rethrow the error for the caller to handle
	}
};

const formatCoinsMessage = (result: { data: CoinDataType[] }, bet: "bet" | null): string => {
	const coinsMessage: string[] = [];
	const filteredCoinsRange = bet ? [2, 3, 4, 5, 6] : Array.from({ length: result.data.length }, (_, i) => i);

	for (const index of filteredCoinsRange) {
		const element = result.data[index];
		coinsMessage.push(`${index + 1}. ${element.tokenData.name} ( ${element.tokenData.symbol} )`);
	}

	const messageType = bet ? "available for betting" : "top 10 trending";

	return `These are the coins that are ${messageType} on the ${result.data[0].network} chain:\n${coinsMessage.join(
		"\n",
	)}`;
};

//fetchCoin("0x38e382F74dfb84608F3C1F10187f6bEf5951DE93", "ethereum");
const fetchCoin = async (address: string, network: string) => {
	try {
		const response = await axios.get(`https://multichain-api.birdeye.so/${network}/overview/token`, {
			params: {
				address: address,
			},
			headers: {
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
				Accept: "application/json, text/plain, /",
				"Accept-Language": "en-US,en;q=0.5",
				"Accept-Encoding": "gzip, deflate, br",
				"agent-id": "f28a43fd-ca0e-4dad-a4ea-b28f8f3805b5",
				"cf-be":
					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDI5ODk5MTgsImV4cCI6MTcwMjk5MDIxOH0.jowdRorsn5TuuYt0B_SwG36jwlmzKLtsJnav5MZ-iAY",
				Origin: "https://birdeye.so",
				Connection: "keep-alive",
				Referer: "https://birdeye.so/",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-site",
				"If-None-Match": 'W/"22c8-TcNjeQoXG+lDekngUVup8/479dc"',
				TE: "trailers",
			},
		});

		return response.data.data;
	} catch (error) {
		console.log("Error fetching coin:", error);
		return null;
	}
};

const sendAllChainData = async (ctx: Context): Promise<void> => {
	const ethdata = await fetchData("solana", null);
	ctx.reply(formatCoinsMessage(ethdata, null));

	const soldata = await fetchData("ethereum", null);
	ctx.reply(formatCoinsMessage(soldata, null));

	const bnbdata = await fetchData("bnb", null);
	ctx.reply(formatCoinsMessage(bnbdata, null));
};

export { formatCoinsMessage, sendAllChainData, fetchCoin };
export default fetchData;
