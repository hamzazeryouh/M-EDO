import ShotList from './ShotList'

export default function MediaBin({ hideHeader, ...props }) {
  return (
    <div className="media-bin">
      {!hideHeader ? (
        <div className="panel-header">
          <strong>Media Bin</strong>
          <span className="muted">{props.shots.length} items</span>
        </div>
      ) : null}
      <ShotList {...props} />
    </div>
  )
}
