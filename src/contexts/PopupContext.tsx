"use client";

import { createContext, useContext, useState } from "react";
import { SpotifyArtist, SpotifyTrack, SpotifyAlbum } from "@/types/spotify";
import DetailsPopup from "@/components/DetailsPopup";

type PopupItem = SpotifyArtist | SpotifyTrack | SpotifyAlbum;

interface PopupContextType {
  showPopup: (item: PopupItem) => void;
  hidePopup: () => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [popupItem, setPopupItem] = useState<PopupItem | null>(null);

  const showPopup = (item: PopupItem) => {
    setPopupItem(item);
  };

  const hidePopup = () => {
    setPopupItem(null);
  };

  return (
    <PopupContext.Provider value={{ showPopup, hidePopup }}>
      {children}
      {popupItem && <DetailsPopup item={popupItem} onClose={hidePopup} />}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (context === undefined) {
    throw new Error("usePopup must be used within a PopupProvider");
  }
  return context;
}
