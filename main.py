import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import secrets
import string
import re
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
bot = telebot.TeleBot(TOKEN)


user_settings = {}

SIMILAR_CHARS = "O0Il1"

# =========================
# 🔤 PASSPHRASE ENGINE
# =========================

WORD_LIST = [
    "forest", "rocket", "planet", "candle", "shadow",
    "ocean", "dragon", "silver", "matrix", "storm",
    "phoenix", "cosmos", "quantum", "falcon", "ember",
    "galaxy", "fusion", "crystal", "neon", "horizon"
]

def generate_passphrase(words_count=4):
    words = [secrets.choice(WORD_LIST) for _ in range(words_count)]
    return "-".join(words)


# =========================
# 📊 PRESETS
# =========================

PRESETS = {
    "social": {"length": 12, "upper": True, "lower": True, "digits": True, "symbols": False},
    "email": {"length": 14, "upper": True, "lower": True, "digits": True, "symbols": True},
    "bank": {"length": 18, "upper": True, "lower": True, "digits": True, "symbols": True},
    "server": {"length": 24, "upper": True, "lower": True, "digits": True, "symbols": True},
    "wifi": {"length": 16, "upper": True, "lower": True, "digits": True, "symbols": False},
}


# =========================
# 🔐 PASSWORD ENGINE
# =========================

def build_charset(settings):
    chars = ""

    if settings["upper"]:
        chars += string.ascii_uppercase
    if settings["lower"]:
        chars += string.ascii_lowercase
    if settings["digits"]:
        chars += string.digits
    if settings["symbols"]:
        chars += "!@#$%^&*()-_=+"

    if settings["exclude_similar"]:
        chars = "".join(c for c in chars if c not in SIMILAR_CHARS)

    return chars


def generate_password(settings):
    chars = build_charset(settings)
    if not chars:
        return None

    return "".join(secrets.choice(chars) for _ in range(settings["length"]))


def generate_from_template(template):
    result = ""

    for char in template:
        if char == "L":
            result += secrets.choice(string.ascii_lowercase)
        elif char == "U":
            result += secrets.choice(string.ascii_uppercase)
        elif char == "d":
            result += secrets.choice(string.digits)
        elif char == "!":
            result += secrets.choice("!@#$%^&*()-_=+")
        else:
            result += char

    return result


# =========================
# 🧠 STRENGTH CHECKER
# =========================

def password_strength(password):
    score = 0

    if len(password) >= 8:
        score += 1
    if len(password) >= 12:
        score += 1
    if re.search(r"[A-Z]", password):
        score += 1
    if re.search(r"[a-z]", password):
        score += 1
    if re.search(r"[0-9]", password):
        score += 1
    if re.search(r"[!@#$%^&*()\-_=+]", password):
        score += 1
    if len(set(password)) > len(password) * 0.7:
        score += 1

    if score <= 2:
        return "🔴 Слабый"
    elif score <= 4:
        return "🟡 Средний"
    elif score <= 6:
        return "🟢 Сильный"
    else:
        return "🟣 Очень сильный"


# =========================
# 🎛 UI
# =========================

def get_keyboard(user_id):
    s = user_settings[user_id]

    kb = InlineKeyboardMarkup(row_width=2)

    kb.add(
        InlineKeyboardButton(f"{'✅' if s['upper'] else '❌'} A-Z", callback_data="toggle_upper"),
        InlineKeyboardButton(f"{'✅' if s['lower'] else '❌'} a-z", callback_data="toggle_lower")
    )

    kb.add(
        InlineKeyboardButton(f"{'✅' if s['digits'] else '❌'} 0-9", callback_data="toggle_digits"),
        InlineKeyboardButton(f"{'✅' if s['symbols'] else '❌'} !@#", callback_data="toggle_symbols")
    )

    kb.add(
        InlineKeyboardButton(f"{'🚫' if s['exclude_similar'] else '⭕'} Искл. похожие", callback_data="toggle_similar")
    )

    kb.add(
        InlineKeyboardButton(f"📏 {s['length']}", callback_data="set_length"),
        InlineKeyboardButton("🚀 Шаблон", callback_data="template_mode")
    )

    kb.add(
        InlineKeyboardButton("🔐 Сгенерировать", callback_data="generate"),
        InlineKeyboardButton("🔄 Ещё один", callback_data="again")
    )
    kb.add(
        InlineKeyboardButton("🔤 Режим слов", callback_data="passphrase"),
        InlineKeyboardButton("🎲 5 шт", callback_data="gen5")
    )

    kb.add(
        InlineKeyboardButton("📊 Пресеты", callback_data="presets")
    )


    return kb


# =========================
# 🤖 BOT LOGIC
# =========================

@bot.message_handler(commands=['start'])
def start(message):
    user_settings[message.from_user.id] = {
        "upper": True,
        "lower": True,
        "digits": True,
        "symbols": True,
        "length": 12,
        "exclude_similar": False,
        "last_password": None
    }

    bot.send_message(
        message.chat.id,
        "🔐 PRO Генератор паролей\n\nВыбери настройки:",
        reply_markup=get_keyboard(message.from_user.id)
    )


@bot.callback_query_handler(func=lambda call: True)
def callback(call):
    user_id = call.from_user.id
    if user_id not in user_settings:
        return

    s = user_settings[user_id]
    changed = False

    if call.data.startswith("toggle_"):
        key = call.data.replace("toggle_", "")
        if key == "similar":
            s["exclude_similar"] = not s["exclude_similar"]
        else:
            s[key] = not s[key]
        changed = True

    elif call.data == "set_length":
        s["length"] += 4
        if s["length"] > 32:
            s["length"] = 8
        changed = True

    elif call.data == "generate":
        password = generate_password(s)
        if not password:
            bot.answer_callback_query(call.id, "⚠ Выберите символы!")
            return

        s["last_password"] = password
        strength = password_strength(password)

        bot.edit_message_text(
            f"🔑 `{password}`\n\nСложность: {strength}",
            call.message.chat.id,
            call.message.message_id,
            parse_mode="Markdown",
            reply_markup=get_keyboard(user_id)
        )
        return

    elif call.data == "again":
        if not s["last_password"]:
            return

        password = generate_password(s)
        s["last_password"] = password
        strength = password_strength(password)

        bot.edit_message_text(
            f"🔑 `{password}`\n\nСложность: {strength}",
            call.message.chat.id,
            call.message.message_id,
            parse_mode="Markdown",
            reply_markup=get_keyboard(user_id)
        )
        return

    elif call.data == "template_mode":
        bot.send_message(
            call.message.chat.id,
            "Введите шаблон.\n\nL — строчная\nU — заглавная\nd — цифра\n! — спецсимвол\n\nПример:\nLLdd!!UU"
        )
        bot.register_next_step_handler(call.message, process_template)
        return
    elif call.data == "passphrase":
        phrase = generate_passphrase(4)
        strength = password_strength(phrase)

        bot.edit_message_text(
            f"🔐 `{phrase}`\n\nСложность: {strength}",
            call.message.chat.id,
            call.message.message_id,
            parse_mode="Markdown",
            reply_markup=get_keyboard(user_id)
        )
        return

    elif call.data == "gen5":
        passwords = [generate_password(s) for _ in range(5)]
        text = "\n".join(f"`{p}`" for p in passwords)

        bot.edit_message_text(
            f"🎲 5 паролей:\n\n{text}",
            call.message.chat.id,
            call.message.message_id,
            parse_mode="Markdown",
            reply_markup=get_keyboard(user_id)
        )
        return

    elif call.data == "presets":
        kb = InlineKeyboardMarkup(row_width=2)
        kb.add(
            InlineKeyboardButton("🌐 Соцсети", callback_data="preset_social"),
            InlineKeyboardButton("📧 Почта", callback_data="preset_email")
        )
        kb.add(
            InlineKeyboardButton("🏦 Банк", callback_data="preset_bank"),
            InlineKeyboardButton("👨‍💻 Сервер", callback_data="preset_server")
        )
        kb.add(
            InlineKeyboardButton("📶 Wi-Fi", callback_data="preset_wifi")
        )

        bot.edit_message_text(
            "📊 Выберите пресет:",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=kb
        )
        return

    elif call.data.startswith("preset_"):
        preset_key = call.data.replace("preset_", "")
        preset = PRESETS[preset_key]

        s.update(preset)

        password = generate_password(s)
        strength = password_strength(password)

        bot.edit_message_text(
            f"🔐 `{password}`\n\nСложность: {strength}",
            call.message.chat.id,
            call.message.message_id,
            parse_mode="Markdown",
            reply_markup=get_keyboard(user_id)
        )
        return


    if changed:
        try:
            bot.edit_message_reply_markup(
                call.message.chat.id,
                call.message.message_id,
                reply_markup=get_keyboard(user_id)
            )
        except:
            pass

    bot.answer_callback_query(call.id)


def process_template(message):
    template = message.text.strip()
    password = generate_from_template(template)
    strength = password_strength(password)

    bot.send_message(
        message.chat.id,
        f"🔑 `{password}`\n\nСложность: {strength}",
        parse_mode="Markdown"
    )


bot.infinity_polling()
