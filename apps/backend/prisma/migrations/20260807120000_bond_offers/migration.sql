-- CreateTable
CREATE TABLE "BondOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "ratePercent" REAL NOT NULL,
    "marginPercent" REAL,
    "nominal" REAL,
    "source" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BondOffer_series_month_key" ON "BondOffer"("series", "month");
