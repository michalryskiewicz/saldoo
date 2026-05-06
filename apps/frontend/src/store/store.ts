import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/lib/base-api.ts';
import preferencesSliceReducer from '@/store/preferences.slice.ts';
import { combineReducers } from '@reduxjs/toolkit';
import { useSelector, type TypedUseSelectorHook } from 'react-redux';
import { rtkQueryErrorMiddleware } from '@/store/error.middleware.ts';

const rootReducer = combineReducers({
  preferences: preferencesSliceReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware, rtkQueryErrorMiddleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
