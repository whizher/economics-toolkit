import {
  cagr,
  compoundProjection,
  inflationEquivalent,
  nominalToReal,
  percentageChange,
  purchasingPower,
  realToNominal,
} from "./src/calculators.mjs";

const currencySelect = document.querySelector("#currency");
const themeToggle = document.querySelector("#theme-toggle");
const forms = [...document.querySelectorAll("[data-calculator]")];

const localeByCurrency = {
  IDR: "id-ID",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
};

function currency(value) {
  const code = currencySelect.value;
  return new Intl.NumberFormat(localeByCurrency[code], {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "IDR" || code === "JPY" ? 0 : 2,
  }).format(value);
}

function percent(value) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value / 100);
}

function number(value) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function valueFrom(data, name) {
  return Number(data.get(name));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showBasicResult(output, label, value, note) {
  const labelNode = element("span", "result-label", label);
  const valueNode = element("strong", "result-value", value);
  const noteNode = element("p", "result-note", note);
  output.classList.remove("error-result");
  output.replaceChildren(labelNode, valueNode, noteNode);
  output.hidden = false;
}

function showError(output, error) {
  output.classList.add("error-result");
  output.textContent = error instanceof Error ? error.message : "Please check the values and try again.";
  output.hidden = false;
}

function calculatePercentage(data, output) {
  const original = valueFrom(data, "original");
  const current = valueFrom(data, "current");
  const change = percentageChange(original, current);
  const direction = change > 0 ? "increase" : change < 0 ? "decrease" : "no change";
  showBasicResult(output, "Percentage change", percent(change), `From ${number(original)} to ${number(current)} — a ${direction}.`);
}

function calculateCagr(data, output) {
  const start = valueFrom(data, "start");
  const end = valueFrom(data, "end");
  const periods = valueFrom(data, "periods");
  const result = cagr(start, end, periods);
  showBasicResult(output, "Compound annual growth rate", percent(result), `${currency(start)} becomes ${currency(end)} across ${number(periods)} years.`);
}

function calculateInflation(data, output) {
  const amount = valueFrom(data, "amount");
  const rate = valueFrom(data, "rate");
  const years = valueFrom(data, "years");
  const mode = data.get("mode");

  if (mode === "equivalent") {
    const result = inflationEquivalent(amount, rate, years);
    showBasicResult(output, "Future equivalent cost", currency(result), `${currency(amount)} today after ${number(years)} years at ${number(rate)}% annual inflation.`);
    return;
  }

  const result = purchasingPower(amount, rate, years);
  showBasicResult(output, "Purchasing power in today’s money", currency(result), `${currency(amount)} held for ${number(years)} years at ${number(rate)}% annual inflation.`);
}

function calculateRealNominal(data, output) {
  const amount = valueFrom(data, "amount");
  const index = valueFrom(data, "index");
  const baseIndex = valueFrom(data, "baseIndex");
  const direction = data.get("direction");

  if (direction === "toReal") {
    const result = nominalToReal(amount, index, baseIndex);
    showBasicResult(output, "Real value", currency(result), `The nominal value is expressed at the base index of ${number(baseIndex)}.`);
    return;
  }

  const result = realToNominal(amount, index, baseIndex);
  showBasicResult(output, "Nominal value", currency(result), `The real value is expressed at the current index of ${number(index)}.`);
}

function summaryItem(label, value) {
  const item = element("div", "summary-item");
  item.append(element("span", "", label), element("strong", "", value));
  return item;
}

function projectionRows(rows) {
  if (rows.length <= 21) return rows;
  return [...rows.slice(0, 11), null, ...rows.slice(-5)];
}

function calculateCompound(data, output) {
  const initial = valueFrom(data, "initial");
  const rate = valueFrom(data, "rate");
  const periods = valueFrom(data, "periods");
  const contribution = valueFrom(data, "contribution");
  const result = compoundProjection(initial, rate, periods, contribution);

  const summary = element("div", "projection-summary");
  summary.append(
    summaryItem("Final value", currency(result.finalValue)),
    summaryItem("Total supplied", currency(result.totalAdded)),
    summaryItem("Growth earned", currency(result.totalGrowth)),
  );

  const tableWrap = element("div", "table-wrap");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const heading of ["Period", "Opening", "Growth", "Addition", "Closing"]) {
    headRow.append(element("th", "", heading));
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  for (const row of projectionRows(result.rows)) {
    const tr = document.createElement("tr");
    if (!row) {
      const gap = element("td", "", "… intermediate periods hidden …");
      gap.colSpan = 5;
      gap.style.textAlign = "center";
      tr.append(gap);
    } else {
      for (const value of [row.period, currency(row.opening), currency(row.growth), currency(row.contribution), currency(row.balance)]) {
        tr.append(element("td", "", String(value)));
      }
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  tableWrap.append(table);

  output.classList.remove("error-result");
  output.replaceChildren(summary, tableWrap);
  output.hidden = false;
}

const calculators = {
  percentage: calculatePercentage,
  cagr: calculateCagr,
  inflation: calculateInflation,
  realNominal: calculateRealNominal,
  compound: calculateCompound,
};

for (const form of forms) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const output = form.parentElement.querySelector("[data-result]");
    try {
      calculators[form.dataset.calculator](new FormData(form), output);
    } catch (error) {
      showError(output, error);
    }
  });
}

currencySelect.addEventListener("change", () => {
  for (const form of forms) form.requestSubmit();
});

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#071813" : "#f5f7f2";
  themeToggle.firstElementChild.textContent = isDark ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  localStorage.setItem("economics-toolkit-theme", theme);
}

const savedTheme = localStorage.getItem("economics-toolkit-theme");
const preferredTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
setTheme(savedTheme || preferredTheme);

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

for (const form of forms) form.requestSubmit();
