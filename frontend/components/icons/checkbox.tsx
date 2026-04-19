import * as React from "react"
import Svg, { SvgProps, Path } from "react-native-svg"
const Checkbox = (props: SvgProps) => (
  <Svg
    width={18}
    height={18}
    fill="none"
    {...props}
  >
    <Path
      fill="#8A6BAD"
      d="m7.6 13.2 7.05-7.05-1.4-1.4L7.6 10.4 4.75 7.55l-1.4 1.4L7.6 13.2ZM2 18c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 16V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h14c.55 0 1.02.196 1.413.588C17.803.979 18 1.45 18 2v14c0 .55-.196 1.02-.587 1.413A1.926 1.926 0 0 1 16 18H2Zm0-2h14V2H2v14Z"
    />
  </Svg>
)
export default Checkbox
