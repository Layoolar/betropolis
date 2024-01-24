import * as command from "@app/functions/commands";
import * as hears from "@app/functions/hears";

/**
 * Start bot
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */
(async () => {
	await command.quit();
	await command.start();
	await command.submitWallet();
	await command.leaderBoard();
	await command.prompt();
	await command.placeBet();
	await command.coinActions();
	await command.getBet();
	await hears.text();
	await command.launch();
})();
