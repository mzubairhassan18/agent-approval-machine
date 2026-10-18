// React 19 + Testing Library need the act environment flag in jsdom.
// @ts-expect-error - assigned for React's act() environment detection
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
