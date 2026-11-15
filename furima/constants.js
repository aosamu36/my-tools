// 共通設定と固定データ
var DATE_PICKER_ROW_HEIGHT = 36;
var TOAST_DURATION_MS = 2800;

var ITEMS_TABLE_NAME = 'furima_items';
var GEMINI_KEY_STORAGE_KEY = 'gemini_key';

var DEFAULT_FEE_RATE = 0.10;
var DEFAULT_SHIPPING_COST = 85;
var YAHOO_FLEA_SHIPPING_COST = 180;
var MERCARI_YUUYU_SHIPPING_COST = 180;
var DEFAULT_PACKING_COST = 10;

var FEE_RATES = {
  'メルカリ': 0.10,
  'Yahoo!フリマ': 0.05,
  'ラクマ': 0.06,
  'ヤフオク': 0.10,
  'PayPayフリマ': 0.05,
  'その他': 0.10
};

var APP_TAG_CLASS = {
  'メルカリ': 'tag-mercari',
  'Yahoo!フリマ': 'tag-yahoo',
  'ラクマ': 'tag-rakuma',
  'ヤフオク': 'tag-yahoo',
  'PayPayフリマ': 'tag-paypay'
};

var SUPPORTED_APP_NAMES = ['メルカリ', 'Yahoo!フリマ', 'ヤフオク', 'ラクマ', 'その他'];
var APP_NAME_ALIASES = {
  'メルカリ': ['メルカリ'],
  'Yahoo!フリマ': ['Yahoo!フリマ', 'Yahooフリマ', 'PayPayフリマ'],
  'ヤフオク': ['ヤフオク'],
  'ラクマ': ['ラクマ'],
  'その他': ['その他']
};
var MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

var RARITIES = [
  'ノーマル', 'ノーレア', 'レア', 'スーパー', 'ウルトラ',
  'シークレット', 'レリーフ', 'ホログラフィック', 'パラレル',
  'ウルトラパラレル', '20th', '25th', 'プリズマ'
];

var RARITY_MAP = {
  'ノーマル':        { title: 'ノーマル',              desc: 'ノーマル' },
  'ノーレア':        { title: 'ノーレア',              desc: 'ノーマルレア' },
  'レア':            { title: 'レア',                  desc: 'レア' },
  'スーパー':        { title: 'スーパー',              desc: 'スーパーレア' },
  'ウルトラ':        { title: 'ウルトラ',              desc: 'ウルトラレア' },
  'シークレット':    { title: 'シク シークレット',      desc: 'シークレットレア' },
  'レリーフ':        { title: 'レリーフ',              desc: 'アルティメットレア' },
  'ホログラフィック':{ title: 'ホロ ホログラフィック', desc: 'ホログラフィックレア' },
  'パラレル':        { title: 'パラレル',              desc: 'パラレル' },
  'ウルトラパラレル':{ title: 'ウルパラ',              desc: 'ウルトラパラレル' },
  '20th':            { title: '20th',                  desc: '20thシークレットレア' },
  '25th':            { title: '25th クオシク',          desc: '25thシークレットレア\nクォーターセンチュリーシークレットレア' },
  'プリズマ':        { title: 'プリズマ プリシク',      desc: 'プリズマティックシークレットレア' }
};

var GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
var GEMINI_IMAGE_RETRY_LIMIT = 3;
var GEMINI_RETRY_DELAY_MS = 3000;
var TRANSACTION_IMAGE_MAX_TOKENS = 500;
var CARD_DESCRIPTION_MAX_TOKENS = 300;
var TRANSACTION_IMAGE_PROMPT =
  'You are a data extraction assistant. Extract information from this Japanese flea market app transaction screenshot. ' +
  'Return ONLY a valid JSON object with no markdown, no backticks, no explanation. ' +
  'Use exactly this format: {"name":"item name in Japanese","date":"YYYY-MM-DD","app":"判別したアプリ名","price":0,"fee_amount":null,"shipping":null,"profit":null,"delivery_method":null}. ' +
  'Choose app exactly from ' + SUPPORTED_APP_NAMES.join(', ') + '. ' +
  'Mercari transaction screens show labels such as 商品名, 商品代金, 販売手数料, 販売利益, 配送の方法, 送料, 購入日時, 商品ID, お届け先. ' +
  'For Mercari, map 商品名 to name, 商品代金 to price, 販売手数料 to fee_amount, 販売利益 to profit, 配送の方法 to delivery_method, 送料 to shipping, and 購入日時 to date; extract each value whenever it is visible. ' +
  'When 販売手数料 and 販売利益 are shown, set app exactly to メルカリ, even if its logo is not visible; do not classify this screen as その他. ' +
  'For Yahoo!フリマ, detect its branding or labels such as 売り上げ履歴を見る and 販売価格, and return app exactly Yahoo!フリマ. ' +
  'For Yahoo!フリマ, extract the item name, sale price shown as 販売価格, and date shown as 購入日時. ' +
  'Extract fee, shipping amount, and delivery method only when explicitly shown; use null when not shown. ' +
  'For delivery_method, use the displayed shipping method name in Japanese. Use null for unknown values. ' +
  'Return その他 only when none of the supported apps can be identified.';
var CARD_DESCRIPTION_PROMPT =
  'これは遊戯王カードの画像です。以下の情報を読み取ってください。\n\n' +
  '読み取る情報：\n' +
  '- カード名（日本語）\n' +
  '- 型番（カード右下や左下に記載されている英数字、例：BLUE-A001、SD12-JP001 など）\n' +
  '- 画像に写っているカードの枚数（1枚なら1、複数枚なら枚数）\n\n' +
  '以下のJSONフォーマットのみで返してください。マークダウンや説明は不要です：\n' +
  '{"card_name":"カード名","card_number":"型番","card_count":1}\n\n' +
  '型番が読み取れない場合は card_number を null にしてください。';

var MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
var IMAGE_VALIDATION_MESSAGE = 'JPEG・PNG・WebP・GIF形式の10MB以下の画像を選択してください';
var SUPPORTED_IMAGE_TYPE = /^image\/(jpeg|png|webp|gif)$/;
var MAX_IMAGE_DIMENSION = 1200;
var JPEG_QUALITY = 0.85;
