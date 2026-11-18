import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from '../navigation';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <section className="login stack">
      <div className="stack stack--small">
        <p className="eyebrow">A private space for your people</p>
        <h1>Keep your people close.</h1>
        <p className="secondary">Remember when you last met. Make room for next time.</p>
      </div>
      <Notice title="Account access isn’t available yet.">
        <p className="supporting secondary">
          You can explore the sample while sign-in is being prepared.
        </p>
      </Notice>
      <form className="stack" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="email">
          Email
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
          />
        </label>
        <label htmlFor="password">
          Password
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
          />
        </label>
        <Button
          variant="quiet"
          className="self-start"
          onClick={() => setShowPassword(!showPassword)}
          aria-controls="password"
          aria-pressed={showPassword}
        >
          {showPassword ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
          {showPassword ? 'Hide password' : 'Show password'}
        </Button>
        <Button type="submit" variant="primary" disabled>
          Sign in
        </Button>
        <p className="supporting secondary">This is a private account. Registration is closed.</p>
      </form>
      <Link className="text-link" href="/design">
        Explore the sample
      </Link>
    </section>
  );
}
