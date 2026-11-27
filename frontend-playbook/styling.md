# Style shared UI with tokens

Start with the [portable CSS](examples/styles.css). Import it once, then add `playbook-ui` to the app shell or a component preview. Set `data-appearance="light"` or `data-appearance="dark"` on that element for an explicit choice. Omit the attribute to follow the device theme.

Use tokens for semantic roles such as surface, text, action, and control boundary. Adjust the palette in one place when adapting the visual identity. Use the shared spacing, typography, radius, and width values before adding screen-specific rules.

Build shared versions of the controls you actually need. A field needs a visible label, an error relationship, and a clear focus indicator. A button needs a label that describes the outcome, a usable touch target, and visible pending and disabled states. Keep important feedback readable without relying on color.

## Verify

- Review both color schemes with contrast checks for text, controls, and focus indicators.
- Try a narrow viewport and enlarged text. Labels, buttons, and errors should wrap without horizontal scrolling.
- Navigate with the keyboard. Check that focus stays visible and returns after closing a dialog.
- Use reduced motion for animated UI and provide a readable state when the animation stops.
