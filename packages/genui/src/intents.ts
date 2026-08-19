/**
 * Intent binding: the ONLY route from a document to behavior.
 *
 * Documents never carry code — an interactive node declares
 * `"intent": "<name>"` and the HOST passes `bindings={{ "<name>": fn }}` to
 * `<GenUIScreen>`. This map designates, per interactive component, WHICH
 * event prop an intent binds to (a component may have several event props;
 * the primary one is a renderer contract decision, documented here).
 *
 * Coverage is pinned by a registry-parity test: every registry component
 * with a function-typed prop in its surface MUST have an entry here, and no
 * entry may name a component without one — so a regenerated registry that
 * adds an interactive component fails closed until this map answers for it.
 */

export interface IntentTarget {
  /** The event prop the host binding is attached to. */
  event: string;
  /**
   * Whether the component is rendered disabled when its intent has no host
   * binding (pressables and form fields — an enabled control that silently
   * does nothing is worse than a disabled one). Components without an
   * `isDisabled` prop simply render inert (event prop omitted).
   */
  disableWhenUnbound?: boolean;
}

export const INTENT_EVENTS: Record<string, IntentTarget> = {
  Alert: { event: 'onDismiss' },
  Button: { event: 'onPress', disableWhenUnbound: true },
  IconButton: { event: 'onPress', disableWhenUnbound: true },
  Checkbox: { event: 'onChange', disableWhenUnbound: true },
  Switch: { event: 'onChange', disableWhenUnbound: true },
  Radio: { event: 'onPress', disableWhenUnbound: true },
  RadioGroup: { event: 'onChange', disableWhenUnbound: true },
  Select: { event: 'onSelectionChange', disableWhenUnbound: true },
  TextField: { event: 'onChange', disableWhenUnbound: true },
  TextArea: { event: 'onChange', disableWhenUnbound: true },
  Tab: { event: 'onPress', disableWhenUnbound: true },
  Tabs: { event: 'onSelectionChange' },
  Dialog: { event: 'onOpenChange' },
  Tooltip: { event: 'onOpenChange' },
};
