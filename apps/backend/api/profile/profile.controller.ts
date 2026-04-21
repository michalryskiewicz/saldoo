import express from 'express';
import { getSessionMiddleware } from '../../middleware';
import prisma from '../../prisma/prisma.ts';

const profile = express.Router();

profile.get('/', getSessionMiddleware, async (req, res) => {
  const userId = req.session.userId;

  const data = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    include: { strategy: true },
  });

  res.status(200).json({
    email: data?.email,
    currency: data?.preferredCurrency,
    strategy: data?.strategy?.strategy,
    encryptionKey: data?.encryptionKey,
    requiredActions: data?.requiredActions,
  });
});

profile.post('/', getSessionMiddleware, async (req, res) => {
  const userId = req.session.userId;

  const data = await prisma.user.update({
    where: { id: userId },
    data: {
      preferredCurrency: req.body.currency,
      requiredActions: req.body.requiredActions,
    },
  });

  await prisma.strategy.upsert({
    where: { userId },
    create: {
      userId,
      strategy: req.body.strategy,
    },
    update: {
      strategy: req.body.strategy,
    },
  });

  res.status(201).json({ data });
});

export default profile;
