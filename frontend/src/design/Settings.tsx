import { Link } from '../navigation';
import { Notice } from '../ui/Notice';
import { AppearanceField, type Appearance } from '../ui/Appearance';
export function DesignSettings({
  appearance,
  setAppearance,
}: {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
}) {
  return (
    <div className="stack stack--large">
      <div className="page-heading">
        <h1>Make it feel like you.</h1>
        <p className="secondary">Your preferences, privacy, and peace of mind.</p>
      </div>
      <section className="surface stack">
        <h2>Appearance</h2>
        <p className="secondary">
          Choose a look that feels comfortable. System follows your device.
        </p>
        <AppearanceField value={appearance} onChange={setAppearance} id="settings-appearance" />
      </section>
      <Notice title="A foundation, taking shape.">
        <p className="supporting secondary">
          This sample has no account, notifications, or personal data. Those controls will arrive as
          their private services are built.
        </p>
      </Notice>
      <Link className="text-link" href="/">
        Back to sign in
      </Link>
    </div>
  );
}
