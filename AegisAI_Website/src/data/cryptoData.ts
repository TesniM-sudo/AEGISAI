const generateSparkData = (seed: number, points = 30): number[] => {
  const data: number[] = [];
  let value = seed;
  for (let i = 0; i < points; i++) {
    value += Math.sin(i * 0.42 + seed * 0.07) * 4 + Math.cos(i * 0.18) * 1.8 + (i % 5 === 0 ? 2 : -0.5);
    data.push(Math.max(value, seed * 0.72));
  }
  return data;
};

export const cryptoAssets = [
  {
    symbol: "AAPL",
    name: "Apple",
    balance: "Tracked in project dataset",
    price: "$214.82",
    change: "+1.92%",
    changePositive: true,
    sparkData: generateSparkData(100),
    color: "hsl(192, 92%, 62%)",
    glowClass: "neon-glow-btc",
    outlook: "Stable large-cap behavior with strong liquidity",
    riskBand: "Low to Medium",
    confidence: "86%",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    balance: "Tracked in project dataset",
    price: "$184.36",
    change: "-1.48%",
    changePositive: false,
    sparkData: generateSparkData(66),
    color: "hsl(350, 82%, 62%)",
    glowClass: "neon-glow-dot",
    outlook: "Momentum-sensitive and reactive to market news",
    riskBand: "Medium to High",
    confidence: "68%",
  },
  {
    symbol: "BTC-USD",
    name: "Bitcoin",
    balance: "Tracked in project dataset",
    price: "$83,420.00",
    change: "+4.26%",
    changePositive: true,
    sparkData: generateSparkData(58),
    color: "hsl(38, 98%, 60%)",
    glowClass: "neon-glow-ada",
    outlook: "High upside potential with wider volatility bands",
    riskBand: "High",
    confidence: "73%",
  },
  {
    symbol: "ETH-USD",
    name: "Ethereum",
    balance: "Tracked in project dataset",
    price: "$4,180.00",
    change: "+2.11%",
    changePositive: true,
    sparkData: generateSparkData(72),
    color: "hsl(268, 76%, 66%)",
    glowClass: "neon-glow-sol",
    outlook: "Strong network narrative with medium-to-high volatility",
    riskBand: "Medium to High",
    confidence: "76%",
  },
  {
    symbol: "EURUSD=X",
    name: "EUR/USD",
    balance: "Tracked in project dataset",
    price: "1.0894",
    change: "+0.34%",
    changePositive: true,
    sparkData: generateSparkData(88),
    color: "hsl(145, 72%, 52%)",
    glowClass: "neon-glow-eth",
    outlook: "Usually steadier than equities or crypto, useful for balance",
    riskBand: "Low",
    confidence: "84%",
  },
] as const;
