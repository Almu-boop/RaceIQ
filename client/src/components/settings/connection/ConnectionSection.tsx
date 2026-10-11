import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveSettings, useSettings } from "@/hooks/settings";
import { m } from "@/paraglide/messages";

export function ConnectionSection() {
  const { displaySettings } = useSettings();
  const saveSettings = useSaveSettings();
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showF1SetupGuide, setShowF1SetupGuide] = useState(false);
  const [game, setGame] = useState<"fm-2023" | "f1-2025" | "pmr">("pmr");
  const udpPort = displaySettings.gameUdpPorts?.[game]
    ?? (game === "pmr" ? 7576 : displaySettings.udpPort ?? 5301);

  return (
    <section>
      <h2 className="text-lg font-semibold text-app-text mb-1">{m.settings_connection_title()}</h2>
      <p className="text-sm text-app-text-muted mb-4">
        {game === "fm-2023" ? m.settings_connection_desc()
          : game === "f1-2025" ? m.setupguide_f1_step2() : m.settings_udp_pmr_help()}
      </p>
      <GamePortSettings game={game} onGameChange={setGame} />
      <div className="mt-4 max-w-xs">
        <Label htmlFor="ws-refresh-rate" className="text-app-text-secondary">
          {m.settings_live_refresh_rate()}
        </Label>
        <select
          id="ws-refresh-rate"
          value={displaySettings.wsRefreshRate ?? "60"}
          onChange={(e) => saveSettings.mutate({ wsRefreshRate: e.target.value })}
          className="mt-1.5 w-full bg-app-surface border border-app-border-input rounded px-3 py-1.5 text-sm text-app-text"
        >
          <option value="60">60 Hz</option>
          <option value="50">50 Hz</option>
          <option value="40">40 Hz</option>
          <option value="30">30 Hz</option>
        </select>
        <p className="text-app-text-muted text-xs mt-1">{m.settings_live_refresh_rate_desc()}</p>
      </div>
      <div className="mt-4 max-w-xs">
        <Label htmlFor="render-fps-cap" className="text-app-text-secondary">
          {m.settings_render_frame_cap()}
        </Label>
        <select
          id="render-fps-cap"
          value={String(displaySettings.renderFpsCap ?? 60)}
          onChange={(e) => saveSettings.mutate({ renderFpsCap: Number(e.target.value) })}
          className="mt-1.5 w-full bg-app-surface border border-app-border-input rounded px-3 py-1.5 text-sm text-app-text"
        >
          <option value="120">120 fps</option>
          <option value="90">90 fps</option>
          <option value="60">60 fps</option>
          <option value="45">45 fps</option>
          <option value="30">30 fps</option>
          <option value="15">15 fps</option>
        </select>
        <p className="text-app-text-muted text-xs mt-1">{m.settings_render_frame_cap_desc()}</p>
      </div>
      {game === "fm-2023" && <div className="mt-6 pt-6 border-t border-app-border">
        <Button variant="app-ghost" size="app-sm" onClick={() => setShowSetupGuide(!showSetupGuide)}>
          <svg aria-hidden="true" className={`w-4 h-4 transition-transform ${showSetupGuide ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {m.settings_forza_guide_toggle()}
        </Button>
        {showSetupGuide && (
          <div className="mt-4 rounded-lg border border-app-border bg-app-surface-alt p-4 max-w-lg">
            <h3 className="text-sm font-semibold text-app-text mb-3">{m.settings_forza_guide_title()}</h3>
            <ol className="space-y-2.5 text-sm text-app-text-muted list-decimal list-inside">
              <li>{m.setupguide_forza_step1()}</li>
              <li>{m.setupguide_forza_step2()}</li>
              <li>{m.setupguide_forza_step3()}</li>
              <li>{m.setupguide_data_out_on()}</li>
              <li>
                {m.setupguide_data_out_ip()} <code className="text-app-accent bg-app-surface rounded px-1 py-0.5 text-xs font-mono">192.168.1.x</code> ).
                <p className="mt-1 text-xs text-app-text-muted/70">
                  {m.settingsguide_same_pc_running()} <code className="text-app-accent bg-app-surface rounded px-1 py-0.5 font-mono">127.0.0.1</code>
                </p>
              </li>
              <li>
                {m.setupguide_data_out_port()} <code className="text-app-accent bg-app-surface rounded px-1 py-0.5 text-xs font-mono">{udpPort || "5301"}</code> {m.settingsguide_match_port_above()}
              </li>
              <li>{m.setupguide_data_out_packet_format()}</li>
            </ol>
            <div className="mt-4 rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2">
              <p className="text-xs text-status-warning">
                <span className="font-semibold">{m.setupguide_note_label()}</span> {m.settingsguide_forza_note()}
              </p>
            </div>
          </div>
        )}
      </div>}
      {game === "f1-2025" && <div className="mt-3">
        <Button variant="app-ghost" size="app-sm" onClick={() => setShowF1SetupGuide(!showF1SetupGuide)}>
          <svg aria-hidden="true" className={`w-4 h-4 transition-transform ${showF1SetupGuide ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {m.settings_f1_guide_toggle()}
        </Button>
        {showF1SetupGuide && (
          <div className="mt-4 rounded-lg border border-app-border bg-app-surface-alt p-4 max-w-lg">
            <h3 className="text-sm font-semibold text-app-text mb-3">{m.settings_f1_guide_title()}</h3>
            <ol className="space-y-2.5 text-sm text-app-text-muted list-decimal list-inside">
              <li>{m.setupguide_f1_step1()}</li>
              <li>{m.setupguide_f1_step2()}</li>
              <li>{m.setupguide_udp_telemetry_on()}</li>
              <li>{m.setupguide_udp_broadcast_off()}</li>
              <li>
                {m.setupguide_udp_ip()}
                <p className="mt-1 text-xs text-app-text-muted/70">
                  {m.settingsguide_same_pc_running()} <code className="text-app-accent bg-app-surface rounded px-1 py-0.5 font-mono">127.0.0.1</code>
                </p>
              </li>
              <li>
                {m.setupguide_udp_port()} <code className="text-app-accent bg-app-surface rounded px-1 py-0.5 text-xs font-mono">{udpPort || "5300"}</code> {m.settingsguide_match_port_above()}
              </li>
              <li>{m.setupguide_udp_send_rate()}</li>
              <li>{m.setupguide_udp_format()}</li>
            </ol>
            <div className="mt-4 rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2">
              <p className="text-xs text-status-warning">
                <span className="font-semibold">{m.setupguide_note_label()}</span> {m.settingsguide_f1_note()}
              </p>
            </div>
          </div>
        )}
      </div>}
    </section>
  );
}


function GamePortSettings({game, onGameChange}: {
  game: "fm-2023" | "f1-2025" | "pmr";
  onGameChange: (game: "fm-2023" | "f1-2025" | "pmr") => void;
}) {
  const { displaySettings } = useSettings();
  const saveSettings = useSaveSettings();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const ports = displaySettings.gameUdpPorts ?? {};
  const selectedPort = ports[game] ?? (game === "pmr" ? 7576 : displaySettings.udpPort ?? 5301);
  useEffect(() => { setValue(String(selectedPort)); setError(""); }, [game, selectedPort]);
  async function save() {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      setError(m.settings_port_range_error()); return;
    }
    try {
      await saveSettings.mutateAsync({gameUdpPorts: {...ports, [game]: port}});
      setError(""); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : m.label_failed_to_save()); }
  }
  return <div className="mt-6 max-w-xs space-y-2">
    <Label htmlFor="udp-game">{m.settings_udp_game()}</Label>
    <select id="udp-game" value={game} onChange={event => {onGameChange(event.target.value as typeof game); setSaved(false);}} className="w-full rounded border border-app-border-input bg-app-surface-alt p-2 text-app-text">
      <option value="pmr">Project Motor Racing</option>
      <option value="fm-2023">Forza Motorsport</option>
      <option value="f1-2025">F1 2025</option>
    </select>
    <Label htmlFor="game-udp-port">{m.label_udp_port()}</Label>
    <Input id="game-udp-port" type="number" min={1024} max={65535} value={value} onChange={event => {setValue(event.target.value); setSaved(false);}} />
    <Button onClick={save} disabled={saveSettings.isPending || Number(value) === selectedPort}>{saveSettings.isPending ? m.common_saving() : saved ? m.common_saved() : m.common_save()}</Button>
    <p className="text-xs text-app-text-muted">{m.settings_udp_restart()}</p>
    {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
  </div>;
}
