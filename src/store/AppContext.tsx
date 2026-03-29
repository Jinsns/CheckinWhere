'use client';

import React, { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AppState, AppAction, POI } from '@/types';

const initialState: AppState = {
  currentCity: null,
  pois: [],
  selectedPois: [],
  hotels: [],
  recommendation: null,
  mapCenter: null,
  mapZoom: 12,
  loading: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CITY':
      return { ...state, currentCity: action.payload };
    case 'SET_POIS':
      return { ...state, pois: action.payload };
    case 'ADD_POI': {
      const exists = state.pois.find(p => p.id === action.payload.id);
      if (exists) return state;
      return { ...state, pois: [...state.pois, action.payload] };
    }
    case 'SELECT_POI': {
      const poi = state.pois.find(p => p.id === action.payload);
      if (!poi) return state;
      const alreadySelected = state.selectedPois.find(p => p.id === action.payload);
      if (alreadySelected) return state;
      return { ...state, selectedPois: [...state.selectedPois, { ...poi, selected: true }] };
    }
    case 'DESELECT_POI':
      return {
        ...state,
        selectedPois: state.selectedPois.filter(p => p.id !== action.payload),
      };
    case 'CLEAR_POIS':
      return { ...state, pois: [], selectedPois: [] };
    case 'SET_HOTELS':
      return { ...state, hotels: action.payload };
    case 'SET_RECOMMENDATION':
      return { ...state, recommendation: action.payload };
    case 'SET_MAP_CENTER':
      return { ...state, mapCenter: action.payload };
    case 'SET_MAP_ZOOM':
      return { ...state, mapZoom: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  togglePoiSelection: (poi: POI) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const togglePoiSelection = (poi: POI) => {
    const isSelected = state.selectedPois.find(p => p.id === poi.id);
    if (isSelected) {
      dispatch({ type: 'DESELECT_POI', payload: poi.id });
    } else {
      dispatch({ type: 'SELECT_POI', payload: poi.id });
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch, togglePoiSelection }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
