import { createSlice } from '@reduxjs/toolkit';

// ===========================================================================
// Slice State
// ===========================================================================
export type PreferencesSliceState = {
  expensesDrawerId?: string;
  profitsDrawerId?: string;
  transactionsDrawerId?: string;
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
  },
});

export const { setExpensesDrawerId, serProfitsDrawerId, setTransactionsDrawerId } =
  preferencesSlice.actions;

export default preferencesSlice.reducer;
