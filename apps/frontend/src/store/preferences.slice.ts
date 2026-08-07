import { createSlice } from '@reduxjs/toolkit';

// ===========================================================================
// Slice State
// ===========================================================================
export type PreferencesSliceState = {
  expensesDrawerId?: string;
  profitsDrawerId?: string;
  transactionsDrawerId?: string;
  goalsDrawerId?: string;
  /** Which goal the 'put aside' drawer is about, if it is open. */
  contributionGoalId?: string;
  /** The expense the goal drawer was opened to replace, if it was opened that way. */
  convertingExpenseId?: string;
  positionsDrawerId?: string;
  /** The goal the holdings drawer was opened from, if it was opened that way. */
  positionFromGoalId?: string;
};

// ===========================================================================
// Slice
// ===========================================================================
const initialState = {} satisfies PreferencesSliceState as PreferencesSliceState;

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setExpensesDrawerId: (state: PreferencesSliceState, action) => {
      state.expensesDrawerId = action.payload;
    },
    serProfitsDrawerId: (state: PreferencesSliceState, action) => {
      state.profitsDrawerId = action.payload;
    },
    setTransactionsDrawerId: (state: PreferencesSliceState, action) => {
      state.transactionsDrawerId = action.payload;
    },
    setGoalsDrawerId: (state: PreferencesSliceState, action) => {
      state.goalsDrawerId = action.payload;
    },
    setContributionGoalId: (state: PreferencesSliceState, action) => {
      state.contributionGoalId = action.payload;
    },
    setConvertingExpenseId: (state: PreferencesSliceState, action) => {
      state.convertingExpenseId = action.payload;
    },
    setPositionsDrawerId: (state: PreferencesSliceState, action) => {
      state.positionsDrawerId = action.payload;
    },
    setPositionFromGoalId: (state: PreferencesSliceState, action) => {
      state.positionFromGoalId = action.payload;
    },
  },
});

export const {
  setExpensesDrawerId,
  serProfitsDrawerId,
  setTransactionsDrawerId,
  setGoalsDrawerId,
  setContributionGoalId,
  setConvertingExpenseId,
  setPositionsDrawerId,
  setPositionFromGoalId,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
