function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
  return number;
}

export function percentageChange(originalValue, newValue) {
  const original = finiteNumber(originalValue, "Original value");
  const current = finiteNumber(newValue, "New value");

  if (original === 0) {
    throw new RangeError("Original value cannot be zero for a percentage change.");
  }

  return ((current - original) / original) * 100;
}

export function cagr(startingValue, endingValue, numberOfPeriods) {
  const start = finiteNumber(startingValue, "Starting value");
  const end = finiteNumber(endingValue, "Ending value");
  const periods = finiteNumber(numberOfPeriods, "Number of periods");

  if (start <= 0) throw new RangeError("Starting value must be greater than zero.");
  if (end < 0) throw new RangeError("Ending value cannot be negative.");
  if (periods <= 0) throw new RangeError("Number of periods must be greater than zero.");

  return (Math.pow(end / start, 1 / periods) - 1) * 100;
}

function inflationInputs(amountValue, annualRate, numberOfYears) {
  const amount = finiteNumber(amountValue, "Amount");
  const rate = finiteNumber(annualRate, "Inflation rate");
  const years = finiteNumber(numberOfYears, "Number of years");

  if (amount < 0) throw new RangeError("Amount cannot be negative.");
  if (rate <= -100) throw new RangeError("Inflation rate must be greater than −100%.");
  if (years < 0) throw new RangeError("Number of years cannot be negative.");

  return { amount, rate: rate / 100, years };
}

export function inflationEquivalent(amountValue, annualRate, numberOfYears) {
  const { amount, rate, years } = inflationInputs(amountValue, annualRate, numberOfYears);
  return amount * Math.pow(1 + rate, years);
}

export function purchasingPower(amountValue, annualRate, numberOfYears) {
  const { amount, rate, years } = inflationInputs(amountValue, annualRate, numberOfYears);
  return amount / Math.pow(1 + rate, years);
}

function indexInputs(amountValue, currentIndex, baseIndexValue) {
  const amount = finiteNumber(amountValue, "Value");
  const index = finiteNumber(currentIndex, "Current price index");
  const baseIndex = finiteNumber(baseIndexValue, "Base price index");

  if (amount < 0) throw new RangeError("Value cannot be negative.");
  if (index <= 0) throw new RangeError("Current price index must be greater than zero.");
  if (baseIndex <= 0) throw new RangeError("Base price index must be greater than zero.");

  return { amount, index, baseIndex };
}

export function nominalToReal(nominalValue, currentIndex, baseIndexValue = 100) {
  const { amount, index, baseIndex } = indexInputs(nominalValue, currentIndex, baseIndexValue);
  return amount * (baseIndex / index);
}

export function realToNominal(realValue, currentIndex, baseIndexValue = 100) {
  const { amount, index, baseIndex } = indexInputs(realValue, currentIndex, baseIndexValue);
  return amount * (index / baseIndex);
}

export function compoundProjection(initialValue, growthRate, numberOfPeriods, recurringContribution = 0) {
  const initial = finiteNumber(initialValue, "Initial value");
  const ratePercent = finiteNumber(growthRate, "Growth rate");
  const periods = finiteNumber(numberOfPeriods, "Number of periods");
  const contribution = finiteNumber(recurringContribution, "Recurring contribution");

  if (initial < 0) throw new RangeError("Initial value cannot be negative.");
  if (ratePercent <= -100) throw new RangeError("Growth rate must be greater than −100%.");
  if (!Number.isInteger(periods) || periods < 1 || periods > 100) {
    throw new RangeError("Number of periods must be a whole number from 1 to 100.");
  }
  if (contribution < 0) throw new RangeError("Recurring contribution cannot be negative.");

  const rate = ratePercent / 100;
  const rows = [{ period: 0, opening: initial, growth: 0, contribution: 0, balance: initial }];
  let balance = initial;

  for (let period = 1; period <= periods; period += 1) {
    const opening = balance;
    const growth = opening * rate;
    balance = opening + growth + contribution;
    rows.push({ period, opening, growth, contribution, balance });
  }

  return {
    rows,
    finalValue: balance,
    totalAdded: initial + contribution * periods,
    totalGrowth: balance - initial - contribution * periods,
  };
}
