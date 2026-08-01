# Economics Toolkit

[![Validate](https://github.com/whizher/economics-toolkit/actions/workflows/validate.yml/badge.svg)](https://github.com/whizher/economics-toolkit/actions/workflows/validate.yml)
[![Deploy](https://github.com/whizher/economics-toolkit/actions/workflows/pages.yml/badge.svg)](https://github.com/whizher/economics-toolkit/actions/workflows/pages.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-62e5a5.svg)](LICENSE)

Five focused calculators for practical economic analysis—without a spreadsheet setup or a black box.

**[Open the live toolkit](https://whizher.github.io/economics-toolkit/)**

## What it includes

| Calculator | Question it answers |
| --- | --- |
| Percentage change | How much did a value rise or fall? |
| CAGR | What constant annual rate connects a starting and ending value? |
| Inflation and purchasing power | What will money cost or buy after inflation? |
| Real vs. nominal value | What remains after adjusting for a price index? |
| Compound growth | How might a value grow with recurring additions? |

The interface supports IDR, USD, EUR, GBP, and JPY display formats, dark and light themes, phones and desktops, and keyboard navigation.

## Why this project exists

Economic formulas are most useful when their assumptions are visible. This toolkit keeps each calculator small, shows its formula beside the inputs, validates impossible values, and performs every calculation locally in the browser.

- No account
- No analytics
- No data sent anywhere
- No framework or runtime dependency

## Formulas

### Percentage change

```text
(new value − original value) ÷ original value × 100
```

### Compound annual growth rate

```text
(ending value ÷ beginning value)^(1 ÷ years) − 1
```

### Inflation equivalent

```text
amount × (1 + annual inflation rate)^years
```

### Real value

```text
nominal value × base price index ÷ current price index
```

### Compound projection

```text
next balance = current balance × (1 + growth rate) + recurring addition
```

Recurring additions are applied at the end of each period.

## Run locally

Clone the repository and serve the directory with any static file server:

```bash
git clone https://github.com/whizher/economics-toolkit.git
cd economics-toolkit
npx serve .
```

Then open the local address shown in your terminal.

## Test

The calculation engine is separated from the interface and tested with Node's built-in test runner:

```bash
npm test
```

GitHub Actions runs the same checks on every push and pull request. A second workflow deploys the static site to GitHub Pages.

## Project structure

```text
.
├── index.html                 # Page structure and calculator forms
├── styles.css                # Responsive visual system
├── app.js                    # Interface, formatting, and rendering
├── src/calculators.mjs       # Pure calculation functions
├── tests/calculators.test.mjs
└── .github/workflows/        # Validation and Pages deployment
```

## Scope

This is an educational project. Results are simplified estimates and are not financial, investment, or policy advice.

## License

[MIT](LICENSE) © 2026 Naufal
