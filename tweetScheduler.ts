import { OdnTweetData, OdnTweets } from "../../../odnTweets"
import { OdnPlugins, OdnPluginResultData } from "../../../odnPlugins";
import { Log } from "../../../odnUtils";
import * as Batch from "../../batch/tweetScheduler/tweetScheduler";

export class TweetScheduler {
  private static command: RegExp;
  private originalQuery: string;

  constructor(private tweetData: OdnTweetData, private fullName: string) {}

  /**
   * プラグインのメイン処理を実行
   *
   * @param {(isProcessed?: boolean) => void} finish
   */
  run(finish: (isProcessed?: boolean) => void) {
    let result: boolean = false;
    let errorMessage: ErrorTypes;
    let reservedNumber: number;
    const isAddSchedule = TweetScheduler.isValidAddAction(this.tweetData);

    // 「@SCREEN_NAME schedule (add|remove)」以降の文字列を取得
    this.originalQuery = this.tweetData.splitedTweet.slice(3).join(" ");
    const quote = (() => {
      if (this.originalQuery && this.originalQuery[0]) {
        return this.originalQuery[0];
      } else {
        return "\"";
      }
    })();
    const parsedQuery = this.originalQuery.match(new RegExp(quote + ".+?" + quote, "g"));

    // TODO: 削除の実装
    if (parsedQuery && 2 === parsedQuery.length) {
      let date: Date;
      let message: string;
      parsedQuery.forEach((str, index) => {
        const data = str.replace(new RegExp("(^" + quote + "|" + quote + "$)", "g"), "");
        if (0 === index) {
          date = new Date(data);
        } else {
          message = data;
        }
      });

      if (date && TweetSchedulerConstants.INVALID_DATE_ERROR != date.toString()) {
        reservedNumber = Batch.TweetScheduler.setSchedule(this.tweetData.accountData.userId, date, message);
        result = true;
      } else {
        // Dateにパースできなかったケース
        errorMessage = ErrorTypes.InvalidDateParam;
      }
    } else {
      errorMessage = isAddSchedule ? ErrorTypes.InvalidAddParams : ErrorTypes.InvalidRemoveParams;
    }

    const tweets = new OdnTweets(this.tweetData.accountData);
    tweets.targetTweetId = this.tweetData.idStr;
    tweets.text = (() => {
      const prefix = "@" + this.tweetData.user.name + " ";
      if (result) {
        return prefix + reservedNumber + "番で予約しました。";
      } else {
        return errorMessage || ErrorTypes.InvalidAddParams;
      }
    })();
    tweets.postTweet(() => {
      finish(result);
    });
  }

  /**
   * プラグインを実行するかどうか判定
   *
   * @param {OdnTweetData} tweetData
   * @returns {boolean}
   */
  static isValid(tweetData: OdnTweetData): boolean {

    return false === tweetData.isRetweet && tweetData.isReplyToMe() && this.isValidCommand(tweetData) && this.isValidAction(tweetData);
  }

  /**
   * 有効なコマンドか
   *
   * @param tweetData
   * @returns {boolean}
   */
  static isValidCommand(tweetData: OdnTweetData): boolean {
    this.setCommand();
    return tweetData.command.match(this.command) ? true : false;
  }

  /**
   * 有効なアクションか
   *
   * @param tweetData
   * @returns {boolean}
   */
  static isValidAction(tweetData: OdnTweetData): boolean {
    return this.isValidAddAction(tweetData) || this.isValidRemoveAction(tweetData);
  }

  /**
   * 有効な追加アクションか
   *
   * @param tweetData
   * @returns {boolean}
   */
  static isValidAddAction(tweetData: OdnTweetData): boolean {
    return tweetData.action.match(/^(add)$/gi) ? true : false;
  }

  /**
   * 有効な削除アクションか
   *
   * @param tweetData
   * @returns {boolean}
   */
  static isValidRemoveAction(tweetData: OdnTweetData): boolean {
    return tweetData.action.match(/^(remove|delete)$/gi) ? true : false;
  }

  /**
   * コマンドとなるワードを環境変数からセット
   */
  private static setCommand() {
    if (!this.command) {
      const text = (() => {
        const pluginName = TweetSchedulerConstants.PLUGIN_FULL_NAME;
        const prefix = TweetSchedulerConstants.CUSTOM_COMMAND_PREFIX;
        const defaultCommand= TweetSchedulerConstants.DEFAULT_COMMAND;
        return OdnPlugins.getEnvData(pluginName, prefix) || defaultCommand;
      })();
      this.command = new RegExp("^(" + text + ")$", "gi");
    }
  }
}


namespace TweetSchedulerConstants {
  export const DEFAULT_COMMAND = "schedule";
  export const PLUGIN_FULL_NAME = "PluginsTweetTweetScheduler";
  export const CUSTOM_COMMAND_PREFIX = "COMMAND";
  export const INVALID_DATE_ERROR = "Invalid Date";
}

enum ErrorTypes {
  InvalidAddParams = "コマンドに誤りがあります。「@NAME schedule add \"時間\" \"投稿メッセージ\"」を指定してください。",
  InvalidRemoveParams = "コマンドに誤りがあります。「@NAME schedule remove \"時間\" \"投稿メッセージ\"」を指定してください。",
  InvalidDateParam = "投稿予定時間のパースに失敗しました。「\"YYYY-MM-DD HH:MM\"」形式で指定してください。"
}