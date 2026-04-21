-- CreateEnum
CREATE TYPE "FREQUENCY" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SEVERITY" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CURRENCY" AS ENUM ('PLN', 'EUR', 'USD');

-- CreateEnum
CREATE TYPE "STRATEGY_PART" AS ENUM ('NEEDS', 'WANTS', 'SAVINGS', 'DEBTS', 'NEEDS_AND_WANTS', 'SHORT_TERM_SAVINGS', 'LONG_TERM_SAVINGS');

-- CreateEnum
CREATE TYPE "BUDGETING_STRATEGY" AS ENUM ('FIFTY_THIRTY_TWENTY', 'FIFTY_TWENTY_THIRTY', 'SIXTY_THIRTY_TEN', 'EIGHTY_TWENTY', 'SEVENTY_TWENTY_TEN', 'TEN_TEN_TEN_SEVENTY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "role" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "strategyId" TEXT,
    "preferredCurrency" "CURRENCY",
    "encryptionKey" TEXT NOT NULL,
    "requiredActions" TEXT[] DEFAULT ARRAY['onboarding']::TEXT[],

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" "CURRENCY" NOT NULL,
    "toCurrency" "CURRENCY" NOT NULL,
    "mid" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "effectiveDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "createdAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "strategy" "BUDGETING_STRATEGY",
    "needs" DOUBLE PRECISION,
    "wants" DOUBLE PRECISION,
    "savings" DOUBLE PRECISION,
    "debts" DOUBLE PRECISION,
    "needsAndWants" DOUBLE PRECISION,
    "shortTermSavings" DOUBLE PRECISION,
    "longTermSavings" DOUBLE PRECISION,
    "userId" TEXT,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_encryptionKey_key" ON "user"("encryptionKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_userId_key" ON "Strategy"("userId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
