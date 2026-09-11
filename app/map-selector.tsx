'use client';

import { useId } from 'react';
import { MAP_IDS, MAPS, isMapId, type MapId } from '../game/maps';
import styles from './map-selector.module.css';

export interface MapSelectorProps {
  value: MapId;
  onChange: (value: MapId) => void;
  disabled?: boolean;
}

/** Place beneath the home sidebar navigation; starting a battle stays a separate action. */
export default function MapSelector({
  value,
  onChange,
  disabled = false,
}: MapSelectorProps) {
  const id = useId();
  const map = MAPS[value];
  return (
    <div className={styles.selector}>
      <label htmlFor={id}>作战地图</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-terrain`}
        onChange={(event) => {
          if (isMapId(event.target.value)) onChange(event.target.value);
        }}
      >
        {MAP_IDS.map((mapId) => (
          <option key={mapId} value={mapId}>
            {MAPS[mapId].name}
          </option>
        ))}
      </select>
      <p id={`${id}-terrain`} title={map.description}>
        <span>{map.terrainLabel}</span>
        <span>{map.coverLabel}</span>
      </p>
    </div>
  );
}
