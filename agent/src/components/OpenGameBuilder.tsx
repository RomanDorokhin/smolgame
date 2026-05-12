import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wand2, RefreshCcw, Copy, Check, Terminal, Info, X, ChevronRight, Gamepad2, Palette, Zap, Clock, Sparkles } from "lucide-react";
import { SmolGameAPI } from "@/lib/smolgame-api";
import { toast } from "sonner";

const GENRES = [
  "Hyper-casual", "Match-3", "Idle/Clicker", "Merge", "Tower Defense", "Roguelike",
  "Runner", "Puzzle", "RPG", "Strategy", "Platformer", "Simulator", "Fighting", "Card"
];
const GENRES_RU = [
  "Гипер-казуал", "Match-3", "Idle/Кликер", "Merge", "Tower Defense", "Рогалик",
  "Раннер", "Головоломка", "РПГ", "Стратегия", "Платформер", "Симулятор", "Файтинг", "Карточная"
];
const SESSION_LENGTHS = ["Ultra-short (<1 min)", "Short (1–3 min)", "Medium (5–15 min)", "Long (30+ min)"];
const SESSION_LENGTHS_RU = ["Ультра-кратко", "Кратко", "Средне", "Долго"];
const CONTROLS = ["Tap", "Swipe", "Virtual stick", "Gyroscope", "Drawing", "Drag & Drop"];
const CONTROLS_RU = ["Тап", "Свайп", "Виртуальный стик", "Гироскоп", "Рисование", "Drag & Drop"];
const ART_STYLES = [
  "Pixel art", "3D cartoon", "Low Poly", "Flat 2D", "Cartoon", "Minimalism",
  "Anime", "Voxel", "Hand-drawn", "Isometric"
];
const ART_STYLES_RU = [
  "Пиксель-арт", "3D мультяшный", "Low Poly", "Flat 2D", "Мультяшный", "Минимализм",
  "Аниме", "Воксель", "Рисованный", "Изометрия"
];
const MECHANICS = [
  "Daily rewards", "Energy system", "Seasonal events", "Social guilds",
  "PvP", "Leaderboards", "Crafting", "Base building", "Collecting", "Turn-based",
  "Physics", "Procedural generation"
];
const MECHANICS_RU = [
  "Награды", "Энергия", "Ивенты", "Гильдии",
  "PvP", "Лидерборды", "Крафт", "База", "Коллекции", "Пошагово",
  "Физика", "Генерация"
];

const EXAMPLES = [
  "Коты защищают тунца от огурцов и пылесосов. Каждый кот — мем с уникальной атакой",
  "Змейка с WASD, тёмная тема, стены убивают, еда ускоряет",
  "Рогалик-данжен: 3 класса, случайные комнаты, лут и финальный босс",
];

const SYSTEM_PROMPT = `You are an expert prompt engineer for OpenGame — an agentic framework that generates fully playable web games from a single prompt.

Your job: transform user game concepts into a single, richly-detailed OpenGame prompt in English.

Study these real OpenGame prompt examples:
- "Build an epic side-scrolling action platformer starring the Avengers. I want to select between Iron Man (lasers & flight), Thor (hammer melee & lightning), or Hulk (smash attacks) to fight through 3 distinct levels: a ruined City, a SHIELD Helicarrier, and finally Titan. Each hero needs a basic attack, a special skill, and a screen-clearing Ultimate move. The final boss must be Thanos using Infinity Stone powers. The art style should be hardcore 90s Capcom arcade pixel art, not cute/chibi."
- "Create a turn-based card battle game set in a pixel art Hogwarts. Play as a wizard student dueling a rival in the Dueling Club. The twist: to cast spell cards you must answer trivia questions correctly. Include a Magic Resonance combo system where consecutive right answers boost spell damage. Gothic fantasy pixel art with parchment-style UI and magical particle effects."

Rules for your output:
1. Write ONE dense, vivid paragraph — no bullet points, no headers
2. Be concrete: name mechanics, describe controls, specify visual style, mention win/loss conditions
3. Include specific engine hint if relevant (Phaser for 2D, Three.js for 3D)
4. Output ONLY the prompt text — no preamble, no explanation`;

interface Props {
  onStart: (prompt: string) => void;
  onCancel: () => void;
  provider?: string;
}

export function OpenGameBuilder({ onStart, onCancel, provider = "gemini" }: Props) {
  const [concept, setConcept] = useState("");
  const [genre, setGenre] = useState("");
  const [session, setSession] = useState("");
  const [controls, setControls] = useState<string[]>([]);
  const [artStyle, setArtStyle] = useState("");
  const [mechanics, setMechanics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultPrompt, setResultPrompt] = useState("");
  const [step, setStep] = useState<"input" | "result">("input");

  const toggleControl = (c: string) => 
    setControls(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  
  const toggleMechanic = (m: string) => 
    setMechanics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const generatePrompt = async () => {
    if (!concept.trim()) {
      toast.error("Опишите концепцию игры");
      return;
    }
    setLoading(true);
    setResultPrompt("");
    
    const genreEn = GENRES[GENRES_RU.indexOf(genre)] || genre;
    const sessionEn = SESSION_LENGTHS[SESSION_LENGTHS_RU.indexOf(session)] || session;
    const artStyleEn = ART_STYLES[ART_STYLES_RU.indexOf(artStyle)] || artStyle;
    const controlsEn = controls.map(c => CONTROLS[CONTROLS_RU.indexOf(c)] || c);
    const mechanicsEn = mechanics.map(m => MECHANICS[MECHANICS_RU.indexOf(m)] || m);

    const userMsg = `Game concept: ${concept.trim()}\n\nParameters:\nGenre: ${genreEn}\nSession: ${sessionEn}\nControls: ${controlsEn.join(", ")}\nArt: ${artStyleEn}\nMechanics: ${mechanicsEn.join(", ")}`;

    try {
      let full = "";
      const stream = SmolGameAPI.chatStream({
        provider,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg }
        ]
      });

      setStep("result");
      for await (const chunk of stream) {
        full += chunk;
        setResultPrompt(full);
      }
    } catch (e: any) {
      toast.error("Ошибка генерации промпта: " + e.message);
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-[#0d0e14]/80 backdrop-blur-xl border-white/5 shadow-2xl rounded-[2rem] overflow-hidden">
      <CardHeader className="border-b border-white/5 bg-white/[0.02] px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 flex items-center justify-center">
              <Wand2 className="text-blue-400" size={20} />
            </div>
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-widest text-white">Game Architect</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-white/30">Параметрический дизайн</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-xl hover:bg-white/5 text-white/40">
            <X size={18} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-8">
        {step === "input" ? (
          <div className="space-y-8">
            {/* Genre & Session */}
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                  <Gamepad2 size={12} /> Жанр
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENRES_RU.slice(0, 8).map(g => (
                    <Badge 
                      key={g} 
                      variant={genre === g ? "default" : "outline"}
                      className={`cursor-pointer px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${genre === g ? "bg-blue-600 text-white" : "hover:bg-white/5 text-white/50 border-white/5"}`}
                      onClick={() => setGenre(g === genre ? "" : g)}
                    >
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                  <Clock size={12} /> Сессия
                </label>
                <div className="flex flex-wrap gap-2">
                  {SESSION_LENGTHS_RU.map(s => (
                    <Badge 
                      key={s} 
                      variant={session === s ? "default" : "outline"}
                      className={`cursor-pointer px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${session === s ? "bg-indigo-600 text-white" : "hover:bg-white/5 text-white/50 border-white/5"}`}
                      onClick={() => setSession(s === session ? "" : s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Art & Controls */}
            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                  <Palette size={12} /> Стиль
                </label>
                <div className="flex flex-wrap gap-2">
                  {ART_STYLES_RU.slice(0, 6).map(a => (
                    <Badge 
                      key={a} 
                      variant={artStyle === a ? "default" : "outline"}
                      className={`cursor-pointer px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${artStyle === a ? "bg-emerald-600 text-white" : "hover:bg-white/5 text-white/50 border-white/5"}`}
                      onClick={() => setArtStyle(a === artStyle ? "" : a)}
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                  <Zap size={12} /> Управление
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTROLS_RU.map(c => (
                    <Badge 
                      key={c} 
                      variant={controls.includes(c) ? "default" : "outline"}
                      className={`cursor-pointer px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${controls.includes(c) ? "bg-amber-600 text-white" : "hover:bg-white/5 text-white/50 border-white/5"}`}
                      onClick={() => toggleControl(c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Mechanics */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Фишки и механики</label>
              <div className="flex flex-wrap gap-2">
                {MECHANICS_RU.map(m => (
                  <Badge 
                    key={m} 
                    variant={mechanics.includes(m) ? "default" : "outline"}
                    className={`cursor-pointer px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${mechanics.includes(m) ? "bg-rose-600 text-white" : "hover:bg-white/5 text-white/50 border-white/5"}`}
                    onClick={() => toggleMechanic(m)}
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Concept */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Концепция игры *</label>
                <div className="flex gap-2">
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => setConcept(ex)} className="text-[9px] text-white/20 hover:text-white transition-colors uppercase font-bold">Пример {i+1}</button>
                  ))}
                </div>
              </div>
              <Textarea 
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder="Опиши игру своими словами — герои, мир, главная цель..."
                className="bg-white/5 border-white/10 rounded-2xl min-h-[100px] text-sm focus:border-blue-500/50 transition-all"
              />
            </div>

            <Button 
              onClick={generatePrompt} 
              disabled={loading || !concept.trim()} 
              className="w-full py-7 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-900/20 text-xs font-black uppercase tracking-widest"
            >
              {loading ? <RefreshCcw className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
              {loading ? "Архитектор проектирует..." : "Сгенерировать ТЗ для агента"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400">
                  <Terminal size={14} /> Результат проектирования
                </div>
                {loading && <RefreshCcw size={14} className="animate-spin text-blue-400" />}
              </div>
              <div className="text-sm leading-relaxed text-white/80 font-medium italic">
                {resultPrompt || "Ожидание..."}
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep("input")} 
                className="flex-1 py-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
              >
                Назад
              </Button>
              <Button 
                onClick={() => onStart(resultPrompt)} 
                disabled={loading}
                className="flex-[2] py-6 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-900/20"
              >
                Начать разработку <ChevronRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
