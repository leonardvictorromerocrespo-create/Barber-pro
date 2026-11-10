import {useId} from 'react';
// Coordinates follow the original portraits; the image underneath stays unchanged.
const barber = [
 'M208 25 C236 45 276 5 300 45 C318 77 293 99 275 102',
 'M196 30 C225 61 261 27 281 60 C295 80 281 99 275 102',
 'M145 64 C178 55 200 86 243 67 C263 62 276 80 270 86',
 'M176 84 C215 100 231 68 256 81',
 'M82 136 C150 73 159 135 215 99 C224 93 229 89 239 88',
 'M275 102 C284 119 282 132 292 152 C308 178 284 177 288 194 C298 214 308 229 319 243 C339 267 302 255 297 267 C299 278 311 285 299 294 C291 302 278 297 266 303',
 'M208 111 C224 160 165 148 170 205',
 'M170 209 C178 239 155 258 163 245 M174 228 L165 260 M177 247 C188 265 180 279 180 277',
 'M130 258 C126 309 129 329 161 340 C193 351 220 372 249 381 C280 393 301 378 293 351 C286 331 272 327 292 315 C304 304 281 304 288 297',
 'M180 258 C194 271 213 278 226 301 C239 323 253 305 256 293 C262 284 274 279 286 276',
 'M259 299 C251 327 255 344 274 343 M284 324 C278 337 291 340 288 359',
 'M147 320 Q150 337 166 341 M157 330 Q162 345 178 349 M171 333 Q170 348 186 353 M184 344 Q183 354 201 360 M195 348 Q194 363 210 364 M210 356 Q208 370 223 369 M223 364 Q223 376 237 376 M240 371 Q246 389 258 374 M258 367 Q263 386 274 373 M273 361 Q283 378 285 360',
 'M234 380 C173 372 198 403 178 425 C171 438 173 454 173 460',
];
const beauty = [
 'M112 24 C99 58 112 92 159 124 C211 161 271 183 271 249',
 'M112 24 C77 98 132 151 204 192 C256 224 300 258 292 326 C282 391 237 403 256 477',
 'M91 65 C66 92 56 125 62 147 C72 169 67 176 49 170',
 'M66 170 C59 189 42 207 29 218 C19 230 30 235 40 239 C58 247 34 255 39 268 C45 281 63 277 77 280',
 'M40 234 C47 231 53 236 57 241',
 'M66 276 C42 269 34 294 51 298 C72 304 43 310 52 331 C59 364 103 343 139 336 C173 325 211 312 219 281',
 'M47 298 Q56 297 65 291',
 'M139 336 C189 337 202 407 177 462',
 'M271 250 C276 290 257 322 241 349',
];
export default function PortraitLight({category, source}) {
 const isBarber=category==='barberia';
 const id=useId().replaceAll(':','');
 const [width,height]=isBarber?[360,475]:[390,490];
 return <svg className="meryo-cover__light" viewBox={isBarber?'0 0 360 475':'0 0 390 490'} aria-hidden="true" focusable="false">
  <defs>
   <filter id={`${id}-ink`} colorInterpolationFilters="sRGB">
    <feColorMatrix type="saturate" values="0" />
    <feComponentTransfer>
     <feFuncR type="linear" slope={isBarber?6:-5} intercept={isBarber?-1:2} />
     <feFuncG type="linear" slope={isBarber?6:-5} intercept={isBarber?-1:2} />
     <feFuncB type="linear" slope={isBarber?6:-5} intercept={isBarber?-1:2} />
    </feComponentTransfer>
   </filter>
   <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
    <image href={source} width={width} height={height} filter={`url(#${id}-ink)`} />
   </mask>
  </defs>
  <g mask={`url(#${id}-mask)`}>
  {(isBarber?barber:beauty).map((d,i)=><path key={i} d={d} pathLength="100" style={{'--trace-delay':`${i*12}ms`}} />)}
 </g></svg>;
}
