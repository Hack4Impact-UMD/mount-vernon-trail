import * as React from "react"
import Svg, { SvgProps, Path } from "react-native-svg"
const BoltIcon = (props: SvgProps) => (
  <Svg
    width={25}
    height={37}
    fill="none"
    {...props}
  >
    <Path
      fill={props.fill ?? "none"}
      d="M9.71 31.38 20.527 18.4h-8.36l1.516-11.882-9.667 13.975h7.263L9.711 31.38ZM6.793 37l2.09-14.413H0L15.635 0h.965l-2.05 16.306H25L7.758 37h-.966Z"
    />
  </Svg>
)
export default BoltIcon
