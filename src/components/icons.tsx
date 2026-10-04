// 图标层：内测反馈「不主张 emoji」后统一走 Ionicons 线性图标（shadcn 风格：细线、克制）。
// 集中在此，避免各屏散落命名与尺寸不一致。
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function Icon({ size = 18, color }: { size?: number; color: ColorValue }) {
    return <Ionicons name={name} size={size} color={color} />;
  };
}

export const StarIcon = icon('star');
export const StarOutlineIcon = icon('star-outline');
export const WarnIcon = icon('alert-circle-outline');
export const VolumeIcon = icon('volume-medium-outline');
export const ChevronBackIcon = icon('chevron-back');
export const ChevronForwardIcon = icon('chevron-forward');
export const SearchIcon = icon('search');
export const FlameIcon = icon('flame-outline');
export const StatsIcon = icon('stats-chart-outline');
export const BookIcon = icon('book-outline');
export const SparkIcon = icon('sparkles-outline');
export const TrophyIcon = icon('trophy-outline');
export const PencilIcon = icon('pencil-outline');
