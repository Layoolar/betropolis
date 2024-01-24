/**
 * Telegraf Hears
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */
import bot from "@app/functions/telegraf";

/**
 * hears: any taxt
 * =====================
 * Listen any text user write
 *
 */

const text = async (): Promise<void> => {
	bot.on("text", async (ctx): Promise<void> => {});
};

export { text };
export default text;
