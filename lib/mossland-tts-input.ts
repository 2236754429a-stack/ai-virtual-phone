const MOSS_TTS_FLASH_MODEL = "moss-tts-1.5-flash";

// Moss API 官方目前只确认 [pause X.Ys]，且仅 1.5 Flash 支持。
const PAUSE_LIKE_TOKEN = /\[\s*pause\b[^\]]*\]/gi;
const VALID_PAUSE_TOKEN = /^\[pause ([0-9]+(?:\.[0-9]+)s)\]$/;

// These are stage directions, not words the speaker is expected to read aloud.
const NONVERBAL_STAGE_DIRECTION = /(?:\(\s*(?:laughs?|sighs?|breath(?:ing)?|笑声?|叹气|叹息|呼吸|喘气)\s*\)|（\s*(?:laughs?|sighs?|breath(?:ing)?|笑声?|叹气|叹息|呼吸|喘气)\s*）|\[\s*(?:laughs?|sighs?|breath(?:ing)?|笑声?|叹气|叹息|呼吸|喘气)\s*\]|【\s*(?:laughs?|sighs?|breath(?:ing)?|笑声?|叹气|叹息|呼吸|喘气)\s*】|［\s*(?:laughs?|sighs?|breath(?:ing)?|笑声?|叹气|叹息|呼吸|喘气)\s*］)/giu;

function isValidPauseSeconds(value: string): boolean {
    if (!/^\d+(?:\.\d+)s$/.test(value)) return false;
    const seconds = Number(value.slice(0, -1));
    return Number.isFinite(seconds) && seconds >= 0.1 && seconds <= 10;
}

/**
 * Keep only Moss API syntax that is documented for the selected model.
 * Ordinary parenthesized prose is intentionally left untouched.
 */
export function normalizeMosslandInput(text: string, model?: string): string {
    const supportsInlinePause = (model || MOSS_TTS_FLASH_MODEL) === MOSS_TTS_FLASH_MODEL;
    let normalized = text.replace(NONVERBAL_STAGE_DIRECTION, "");

    normalized = normalized.replace(PAUSE_LIKE_TOKEN, token => {
        const pause = VALID_PAUSE_TOKEN.exec(token);
        return supportsInlinePause && pause && isValidPauseSeconds(pause[1]) ? token : "";
    });

    // Removing a stage direction or unsupported control token can leave doubled
    // horizontal whitespace, but preserve line breaks and all other punctuation.
    return normalized.replace(/[ \t]{2,}/g, " ").trim();
}

export const MOSS_TTS_MODEL = MOSS_TTS_FLASH_MODEL;
