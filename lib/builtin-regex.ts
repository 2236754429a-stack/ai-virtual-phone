// lib/builtin-regex.ts
// 内置正则组：随应用分发，loadRegexes 时自动种子/升级（模式与内置预设保持一致）。
// 斯塔克工业 · J.A.R.V.I.S. HUD 套件：AI 输出 <hud>/<arc>/<jarvis>/<suit>/<holo>/<alert> 标记，
// 即渲染为斯塔克工业风格的全息界面。使用协议由组内 promptOnly 注入规则自动携带，
// 用户可在正则管理中按规则单独开关；升级版本时保留用户的开关状态。

import type { RegexConfig, RegexRule } from "./settings-types";

export const BUILTIN_REGEX_VERSION = 1;

const BUILTIN_STARK_HUD_RULES: RegexRule[] =
    [
    {
        "id": "regex-rule-stark-hud-panel",
        "scriptName": "斯塔克HUD主面板",
        "findRegex": "/<hud>([\\s\\S]*?)<\\/hud>/gi",
        "replaceString": "<style>\n.stark-hud{position:relative;margin:6px 0;padding:12px 14px;border-radius:10px;background:linear-gradient(160deg,rgba(8,16,24,.92),rgba(6,10,16,.86));border:1px solid rgba(0,212,255,.35);box-shadow:0 0 14px rgba(0,212,255,.18),inset 0 0 22px rgba(0,212,255,.06);color:#cfeeff;font-size:13px;line-height:1.75;overflow:hidden}\n.stark-hud::before{content:'';position:absolute;top:0;left:-60%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(0,212,255,.10),transparent);animation:starkScan 3.4s linear infinite;pointer-events:none}\n@keyframes starkScan{to{left:115%}}\n.stark-hud i{position:absolute;width:13px;height:13px;border:2px solid #00d4ff;pointer-events:none}\n.stark-hud i.tl{top:4px;left:4px;border-right:none;border-bottom:none}\n.stark-hud i.tr{top:4px;right:4px;border-left:none;border-bottom:none}\n.stark-hud i.bl{bottom:4px;left:4px;border-right:none;border-top:none}\n.stark-hud i.br{bottom:4px;right:4px;border-left:none;border-top:none}\n.stark-hud .tag{display:inline-block;font-size:10px;letter-spacing:2px;color:#00d4ff;border:1px solid rgba(0,212,255,.4);padding:1px 8px;border-radius:3px;margin-bottom:6px;background:rgba(0,212,255,.08)}\n.stark-hud .body{white-space:pre-line}\n.stark-hud .body b,.stark-hud .body strong{color:#8fe0ff}\n</style>\n<div class=\"stark-hud\"><i class=\"tl\"></i><i class=\"tr\"></i><i class=\"bl\"></i><i class=\"br\"></i><span class=\"tag\">STARK OS · J.A.R.V.I.S.</span><div class=\"body\">$1</div></div>",
        "disabled": false,
        "placement": [
            2
        ],
        "markdownOnly": true,
        "runOnEdit": true
    },
    {
        "id": "regex-rule-stark-arc-reactor",
        "scriptName": "方舟反应堆读数",
        "findRegex": "/<arc>\\s*([0-9]{1,3}(?:\\.[0-9])?)\\s*<\\/arc>/gi",
        "replaceString": "<style>\n.stark-arc{display:flex;align-items:center;gap:13px;margin:6px 0;padding:10px 14px;border-radius:12px;background:radial-gradient(circle at 16% 50%,rgba(0,180,255,.16),rgba(6,10,16,.92) 42%);border:1px solid rgba(0,212,255,.3);box-shadow:0 0 12px rgba(0,212,255,.15)}\n.stark-arc .core{position:relative;width:50px;height:50px;flex:none}\n.stark-arc .core i{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(0,212,255,.75);border-top-color:transparent;animation:starkSpin 2.4s linear infinite;box-shadow:0 0 10px rgba(0,212,255,.5)}\n.stark-arc .core i.in{inset:7px;border-top-color:rgba(140,235,255,.9);animation-duration:1.6s;animation-direction:reverse}\n.stark-arc .core::after{content:'';position:absolute;inset:16px;border-radius:50%;background:radial-gradient(circle,#eaffff,#4fd8ff 62%,rgba(0,180,255,.2));box-shadow:0 0 15px #4fd8ff;animation:starkPulse 1.8s ease-in-out infinite}\n@keyframes starkSpin{to{transform:rotate(360deg)}}\n@keyframes starkPulse{50%{box-shadow:0 0 26px #7fe4ff}}\n.stark-arc .info{font-size:11px;color:#8fc9e8;letter-spacing:1px;line-height:1.6}\n.stark-arc .val{font-size:21px;font-weight:700;color:#eaffff;text-shadow:0 0 8px #4fd8ff;font-family:ui-monospace,Consolas,monospace;margin-right:3px}\n</style>\n<div class=\"stark-arc\"><div class=\"core\"><i></i><i class=\"in\"></i></div><div class=\"info\"><span class=\"val\">$1</span><span>OUTPUT / 100</span><br>ARC REACTOR · 稳定</div></div>",
        "disabled": false,
        "placement": [
            2
        ],
        "markdownOnly": true,
        "runOnEdit": true
    },
    {
        "id": "regex-rule-stark-jarvis-term",
        "scriptName": "贾维斯终端日志",
        "findRegex": "/<jarvis>([\\s\\S]*?)<\\/jarvis>/gi",
        "replaceString": "<style>\n.stark-term{margin:6px 0;border-radius:8px;background:#04080c;border:1px solid rgba(0,255,170,.25);box-shadow:0 0 10px rgba(0,255,170,.12);font-family:ui-monospace,Consolas,Menlo,monospace;font-size:12px;color:#9ff5d8;overflow:hidden}\n.stark-term .bar{display:flex;align-items:center;gap:5px;padding:6px 10px;background:rgba(0,255,170,.06);border-bottom:1px solid rgba(0,255,170,.18)}\n.stark-term .bar b{width:8px;height:8px;border-radius:50%;flex:none}\n.stark-term .bar b:nth-child(1){background:#ff5f57}\n.stark-term .bar b:nth-child(2){background:#febc2e}\n.stark-term .bar b:nth-child(3){background:#28c840}\n.stark-term .bar span{margin-left:6px;font-size:10px;letter-spacing:2px;color:#57c99a}\n.stark-term .body{padding:9px 12px;white-space:pre-line;line-height:1.7}\n.stark-term .body::after{content:'▊';color:#4dffc6;animation:starkBlink 1s steps(1) infinite}\n@keyframes starkBlink{50%{opacity:0}}\n</style>\n<div class=\"stark-term\"><div class=\"bar\"><b></b><b></b><b></b><span>J.A.R.V.I.S. TERMINAL</span></div><div class=\"body\">$1</div></div>",
        "disabled": false,
        "placement": [
            2
        ],
        "markdownOnly": true,
        "runOnEdit": true
    },
    {
        "id": "regex-rule-stark-suit-diag",
        "scriptName": "战衣诊断面板",
        "findRegex": "/<suit>([\\s\\S]*?)<\\/suit>/gi",
        "replaceString": "<style>\n.stark-suit{position:relative;margin:6px 0;padding:10px 13px 11px;border-radius:10px;background:linear-gradient(180deg,rgba(22,10,8,.92),rgba(10,6,5,.94));border:1px solid rgba(255,184,77,.35);box-shadow:0 0 12px rgba(255,140,60,.16),inset 0 1px 0 rgba(255,200,120,.12);color:#ffd9a8;font-size:12.5px;line-height:1.85;overflow:hidden}\n.stark-suit::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:repeating-linear-gradient(45deg,rgba(255,184,77,.55) 0 8px,transparent 8px 16px)}\n.stark-suit .tag{display:inline-block;font-size:10px;letter-spacing:2px;color:#ffb84d;border:1px solid rgba(255,184,77,.45);padding:1px 8px;border-radius:3px;margin:2px 0 6px;background:rgba(255,184,77,.08)}\n.stark-suit .body{white-space:pre-line}\n</style>\n<div class=\"stark-suit\"><span class=\"tag\">MARK SUIT · DIAGNOSTICS</span><div class=\"body\">$1</div></div>",
        "disabled": false,
        "placement": [
            2
        ],
        "markdownOnly": true,
        "runOnEdit": true
    },
    {
        "id": "regex-rule-stark-holo-file",
        "scriptName": "全息档案卡",
        "findRegex": "/<holo>([\\s\\S]*?)<\\/holo>/gi",
        "replaceString": "<style>\n.stark-holo{position:relative;margin:6px 0;padding:10px 13px 11px;border-radius:6px;background:linear-gradient(135deg,rgba(0,220,255,.10),rgba(0,220,255,.03));border:1px solid rgba(0,220,255,.45);color:#d8f7ff;font-size:12.5px;line-height:1.75;white-space:pre-line;box-shadow:0 0 14px rgba(0,220,255,.2),inset 0 0 18px rgba(0,220,255,.08);animation:starkFlicker 4.5s infinite;overflow:hidden}\n.stark-holo::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:repeating-linear-gradient(90deg,rgba(0,220,255,.6) 0 10px,transparent 10px 20px)}\n.stark-holo::after{content:'HOLO-FILE · 目标锁定';position:absolute;bottom:5px;right:10px;font-size:9px;letter-spacing:2px;color:rgba(0,220,255,.55)}\n.stark-holo .body{margin-bottom:14px}\n@keyframes starkFlicker{0%,88%,100%{opacity:1}90%{opacity:.55}92%{opacity:1}95%{opacity:.78}96%{opacity:1}}\n</style>\n<div class=\"stark-holo\"><div class=\"body\">$1</div></div>",
        "disabled": false,
        "placement": [
            2
        ],
        "markdownOnly": true,
        "runOnEdit": true
    },
    {
        "id": "regex-rule-stark-alert",
        "scriptName": "斯塔克警报条",
        "findRegex": "/<alert(?:\\s+level=[\"']?([a-z]+)[\"']?)?>([\\s\\S]*?)<\\/alert>/gi",
        "replaceString": "<style>\n.stark-alert{position:relative;margin:6px 0;padding:10px 12px 10px 36px;border-radius:8px;background:rgba(40,16,6,.92);border:1px solid rgba(255,120,50,.5);color:#ffd9b8;font-size:12.5px;line-height:1.7;box-shadow:0 0 12px rgba(255,100,40,.22)}\n.stark-alert::before{content:'⚠';position:absolute;left:12px;top:10px;color:#ffb84d;font-size:15px;animation:starkPulse 1.2s ease-in-out infinite}\n.stark-alert .lv{position:absolute;top:8px;right:10px;font-size:9px;letter-spacing:2px;color:rgba(255,184,77,.8)}\n.stark-alert.lv-critical{background:rgba(46,8,10,.94);border-color:rgba(255,70,70,.6);color:#ffc9c9;box-shadow:0 0 14px rgba(255,60,60,.35)}\n.stark-alert.lv-critical::before{content:'⛔';color:#ff6b6b}\n.stark-alert.lv-critical .lv{color:rgba(255,107,107,.9)}\n.stark-alert .body{white-space:pre-line}\n</style>\n<div class=\"stark-alert lv-$1\"><span class=\"lv\">$1</span><div class=\"body\">$2</div></div>",
        "disabled": false,
        "placement": [
            2
        ],
        "markdownOnly": true,
        "runOnEdit": true
    },
    {
        "id": "regex-rule-stark-hud-protocol",
        "scriptName": "斯塔克HUD使用协议（自动注入）",
        "findRegex": "^([\\s\\S]*)$",
        "replaceString": "$1\n\n[斯塔克工业 HUD 渲染协议] 需要展示系统级信息时，可在回复中使用以下全息标记（标签内紧凑书写、行与行之间不要空行、不要用 Markdown 符号）：<hud>面板正文</hud>=J.A.R.V.I.S.主面板（战况汇总/环境扫描/系统消息）；<arc>0-100数字</arc>=方舟反应堆输出功率；<jarvis>每行一条指令或回报</jarvis>=贾维斯终端日志；<suit>每行一条，用▰▱拼进度条，如：推进系统 ▰▰▰▰▰▱▱▱ 62%</suit>=战衣诊断；<holo>目标档案：姓名/身份/威胁等级/备注</holo>=全息档案卡；<alert level=\"critical\">警报内容</alert>=警报条（level 可省略，critical 为红色升级警报）。普通闲聊不要使用；每次回复最多 1-2 个标记；仅在信息值得可视化时使用。",
        "disabled": false,
        "placement": [
            1
        ],
        "promptOnly": true,
        "runOnEdit": false,
        "minDepth": 0,
        "maxDepth": 0
    }
];

export function createBuiltinRegexGroups(): RegexConfig {
    return {
        id: "regex-builtin-stark-hud",
        name: "斯塔克工业 · J.A.R.V.I.S. HUD 套件",
        description: "钢铁侠风格全息渲染套件（内置）：AI 输出 <hud>/<arc>/<jarvis>/<suit>/<holo>/<alert> 标记即渲染为斯塔克工业风格界面。聊天与剧情通用；全部仅影响显示、不污染历史内容；使用协议由组内「斯塔克HUD使用协议」规则自动注入（可单独关闭该规则，改为把协议文本贴进世界书）。",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        builtIn: true,
        builtInVersion: BUILTIN_REGEX_VERSION,
        rules: JSON.parse(JSON.stringify(BUILTIN_STARK_HUD_RULES)) as RegexRule[],
    };
}
