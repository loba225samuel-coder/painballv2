import { useState } from "react";
import { Users, Radio, Copy, Check, LogOut, AlertTriangle, KeyRound, Swords, Loader2, ClipboardPaste } from "lucide-react";
import type { NetStatus } from "@/game/net";
import { normalizeCode } from "@/game/net";

interface Props {
  status: NetStatus;
  detail: string;
  code: string;
  localSdp: string;
  onHost: () => void;
  onJoin: (code: string) => void;
  onManualAnswer: (sdp: string) => void;
  onManualJoin: (sdp: string) => void;
  onCancel: () => void;
}

const busy = (s: NetStatus) => s === "creating" || s === "joining" || s === "connecting" || s === "waiting";

function Chip({ tone, children }: { tone: "wait" | "live" | "err" | "idle"; children: React.ReactNode }) {
  const map = {
    wait: "bg-gold/15 text-gold border-gold/40",
    live: "bg-lime-hot/15 text-lime-hot border-lime-hot/40",
    err: "bg-magenta-hot/15 text-magenta-hot border-magenta-hot/40",
    idle: "bg-court-600/60 text-moss border-line",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-[3px] font-cond text-[10px] font-extrabold tracking-[0.16em] ${map[tone]}`}>
      {children}
    </span>
  );
}

export default function OnlinePanel({
  status,
  detail,
  code,
  localSdp,
  onHost,
  onJoin,
  onManualAnswer,
  onManualJoin,
  onCancel,
}: Props) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const isManual = status === "manual";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers refusé : le code reste lisible à l'écran */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/70 px-3 py-2">
          <Radio className="h-4 w-4 text-lime-hot" />
          <h3 className="font-display text-[12px] tracking-wide text-chalk">CO-OP EN LIGNE</h3>
          <span className="ml-auto">
            {status === "live" ? (
              <Chip tone="live">CONNECTÉ</Chip>
            ) : busy(status) ? (
              <Chip tone="wait">
                <Loader2 className="h-3 w-3 animate-spin" /> EN COURS
              </Chip>
            ) : status === "error" ? (
              <Chip tone="err">ERREUR</Chip>
            ) : (
              <Chip tone="idle">SALON PRIVÉ</Chip>
            )}
          </span>
        </div>

        <div className="p-3">
          {status === "idle" && (
            <>
              <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
                UN JOUEUR CRÉE UN SALON, L'AUTRE LE REJOINT AVEC LE CODE À 4 LETTRES. P2 JOUE AUX FLÈCHES COMME EN DUO LOCAL.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={onHost}
                  className="btn flex items-center gap-2 bg-lime-hot px-4 py-2.5 text-[13px] text-court-900"
                >
                  <Users className="h-4 w-4" /> CRÉER UN SALON
                </button>
                <div className="flex items-stretch gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(normalizeCode(e.target.value))}
                    placeholder="CODE"
                    aria-label="Code du salon"
                    maxLength={6}
                    className="w-24 border-2 border-line bg-court-700 px-2 py-2 text-center font-display text-[15px] tracking-[0.22em] text-cyan-hot outline-none focus:border-cyan-hot"
                  />
                  <button
                    onClick={() => onJoin(input)}
                    disabled={input.length < 4}
                    className="btn bg-cyan-hot px-3 py-2.5 text-[13px] text-court-900 disabled:opacity-40"
                  >
                    REJOINDRE
                  </button>
                </div>
              </div>
            </>
          )}

          {(status === "creating" || status === "waiting" || status === "connecting" || status === "live") && (
            <div className="flex flex-col items-center gap-2">
              <div className="font-cond text-[10px] font-extrabold tracking-[0.24em] text-moss">CODE DU SALON</div>
              <div className="flex items-center gap-2">
                <span
                  className="font-display text-4xl tracking-[0.28em] text-cyan-hot"
                  style={{ textShadow: "0 3px 0 #05100d, 0 0 26px rgba(62,232,255,0.35)" }}
                >
                  {code || "····"}
                </span>
                <button
                  onClick={copy}
                  aria-label="Copier le code"
                  className="panel flex h-9 w-9 items-center justify-center text-chalk/70 transition hover:border-cyan-hot hover:text-cyan-hot"
                >
                  {copied ? <Check className="h-4 w-4 text-lime-hot" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-center font-cond text-[11px] font-bold tracking-[0.14em] text-moss">
                {detail || (status === "live" ? "CONNECTÉ" : "EN ATTENTE DU 2E JOUEUR…")}
              </p>
              <button onClick={onCancel} className="btn flex items-center gap-2 bg-court-600 px-3 py-2 text-[11px] text-chalk">
                <LogOut className="h-3.5 w-3.5" /> QUITTER LE SALON
              </button>
            </div>
          )}

          {status === "joining" && (
            <p className="font-cond text-[11px] font-bold tracking-[0.14em] text-moss">{detail || "RECHERCHE DU SALON…"}</p>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 border-l-2 border-magenta-hot bg-magenta-hot/10 px-2.5 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-magenta-hot" />
                <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-chalk/85">
                  {detail || "CONNEXION IMPOSSIBLE."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={onHost} className="btn flex items-center gap-2 bg-cyan-hot px-3 py-2 text-[12px] text-court-900">
                  <KeyRound className="h-3.5 w-3.5" /> RÉESSAYER
                </button>
                <button onClick={onCancel} className="btn flex items-center gap-2 bg-court-600 px-3 py-2 text-[12px] text-chalk">
                  <LogOut className="h-3.5 w-3.5" /> FERMER
                </button>
              </div>
            </div>
          )}

          {isManual && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 border-l-2 border-gold bg-gold/10 px-2.5 py-2">
                <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="font-cond text-[11px] font-bold leading-snug tracking-wide text-chalk/85">
                  SIGNALISATION INDISPONIBLE SUR CETTE HÉBERGEMENT. ÉCHANGEZ CES DEUX BLOCS PAR UN AUTRE CANAL
                  (MESSAGE, E-MAIL) POUR RELIER LES DEUX JOUEURS.
                </p>
              </div>
              <textarea
                readOnly
                value={localSdp}
                rows={3}
                aria-label="SDP local à envoyer"
                className="w-full resize-none border-2 border-line bg-court-700 p-2 font-cond text-[10px] leading-tight text-lime-hot outline-none"
              />
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={3}
                placeholder="Colle ici le bloc reçu de l'autre joueur"
                aria-label="SDP reçu"
                className="w-full resize-none border-2 border-line bg-court-700 p-2 font-cond text-[10px] leading-tight text-cyan-hot outline-none focus:border-cyan-hot"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onManualAnswer(paste)}
                  disabled={!paste.trim()}
                  className="btn flex-1 bg-cyan-hot px-3 py-2 text-[11px] text-court-900 disabled:opacity-40"
                >
                  VALIDER LA RÉPONSE
                </button>
                <button
                  onClick={() => onManualJoin(paste)}
                  disabled={!paste.trim()}
                  className="btn flex-1 bg-lime-hot px-3 py-2 text-[11px] text-court-900 disabled:opacity-40"
                >
                  COLLER L'OFFRE
                </button>
              </div>
              <button onClick={onCancel} className="btn flex items-center justify-center gap-2 bg-court-600 px-3 py-2 text-[11px] text-chalk">
                <LogOut className="h-3.5 w-3.5" /> ANNULER
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="panel opacity-80">
        <div className="flex items-center gap-2 border-b-2 border-line bg-court-700/50 px-3 py-2">
          <Swords className="h-4 w-4 text-magenta-hot" />
          <h3 className="font-display text-[12px] tracking-wide text-chalk">VERSUS 1 CONTRE 1</h3>
          <Chip tone="idle">BIENTÔT</Chip>
        </div>
        <p className="px-3 py-2 font-cond text-[11px] font-bold leading-snug tracking-wide text-moss">
          DUEL DE PEINTURE SUR COURT FERMÉ, AVEC PRÉDICTION ET ROLLBACK SUR LES TIRS. IL ARRIVE QUAND LA CO-OP
          EN LIGNE SERA STABLE — C'EST LA SEULE PARTIE QUI DEMANDE UN VRAI NETCODE COMPÉTITIF.
        </p>
      </div>
    </div>
  );
}
