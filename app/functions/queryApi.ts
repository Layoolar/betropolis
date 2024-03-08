const openaiApiKey = process.env.OPENAIKEY;

export const queryAi = async (text: string): Promise<string> => {
	let aiReply = "";
	await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${openaiApiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "user",
					content: text,
				},
			],
			temperature: 0.7,
		}),
	})
		.then((response) => response.json())
		.then((data) => {
			aiReply = data.choices[0].message.content as string;
			console.log(aiReply);
			//console.log(data);
		})
		.catch((error) => {
			console.log("Error:", error);
			return "error";
		});
	return aiReply;
};
