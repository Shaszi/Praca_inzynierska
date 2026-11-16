import { PageHeader } from '../components/ui'
import { SmoothingControl } from '../features/canvas/components/SmoothingControl'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { SettingSlider } from '../features/settings/SettingSlider'
import { SettingToggle } from '../features/settings/SettingToggle'
import { useAppSettings } from '../features/settings/useAppSettings'
import { SyncStatus } from '../features/settings/SyncStatus'

export function SettingsPage() {
  const { settings, update, sync } = useAppSettings()
  const { smoothing, setSmoothing } = useSmoothingSettings()

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Ustawienia" description="Zapisują się na Twoim koncie — działają na każdym urządzeniu, na którym się zalogujesz." />
      <SyncStatus sync={sync} />

      <h3 className="mt-2 text-[15px] font-semibold text-ink-faint">Prowadzenie</h3>
      <SettingToggle
        label="Prowadź kadr za linią kroku"
        description="Przy każdym nowym kroku płótno płynnie przesuwa się tak, żeby linia do narysowania była na środku ekranu."
        checked={settings.followGuide}
        onChange={(followGuide) => update({ followGuide })}
      />
      <SettingSlider
        label="Widoczność linii pomocniczych"
        description="Jak mocno widać linię, po której rysujesz. Słabsza linia to większe wyzwanie — rysujesz bardziej z oka."
        value={settings.guideOpacity}
        min={0.15}
        max={1}
        step={0.05}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(guideOpacity) => update({ guideOpacity })}
      />

      <h3 className="mt-2 text-[15px] font-semibold text-ink-faint">Kreska</h3>
      <div className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4">
        <p className="m-0 text-[15.5px] font-semibold text-ink">Stabilizacja kreski</p>
        <p className="m-0 text-[14px] text-ink-soft">
          Wygładza drżenie ręki. „Płynne” prawie nie opóźnia pędzla, „Linka” daje najczystsze linie, ale pędzel podąża z opóźnieniem.
        </p>
        <SmoothingControl value={smoothing} onChange={setSmoothing} />
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-ink-faint">Tablet</h3>
      <SettingToggle
        label="Rysuj tylko rysikiem"
        description="Palec nie rysuje — przesuwa płótno. Chroni przed przypadkowymi kreskami od dłoni opartej o ekran."
        checked={settings.penOnly}
        onChange={(penOnly) => update({ penOnly })}
      />
      <SettingToggle
        label="Stuknięcie 2 i 3 palcami"
        description="Dwa palce cofają, trzy ponawiają — jak w Procreate."
        checked={settings.tapGestures}
        onChange={(tapGestures) => update({ tapGestures })}
      />
      <SettingToggle
        label="Obracanie dwoma palcami"
        description="Przekręć palce, żeby obrócić płótno. Wyłączone — płótno zawsze stoi prosto, dwa palce tylko przesuwają i przybliżają."
        checked={settings.rotateGesture}
        onChange={(rotateGesture) => update({ rotateGesture })}
      />
    </section>
  )
}
