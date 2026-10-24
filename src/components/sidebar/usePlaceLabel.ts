import type { TrackPosition } from '../../core/project/schema';
import { formatNumber, t } from '../../i18n';
import { useProjectStore } from '../../stores/project';

/** Short text for a track position: its control point number, plus the distance after it. */
export function usePlaceLabel() {
  const store = useProjectStore();
  const pointNumber = (id: string) => String((store.pointIndex.get(id) ?? 0) + 1).padStart(2, '0');
  return (position: TrackPosition) =>
    position.distance
      ? t('position.place', {
          point: pointNumber(position.point),
          distance: formatNumber(position.distance),
        })
      : pointNumber(position.point);
}
