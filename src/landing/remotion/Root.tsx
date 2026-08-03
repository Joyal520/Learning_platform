import { Composition } from "remotion";
import { EdtechraShowcase } from "./EdtechraShowcase";
import {
  AiFilmPreview,
  FILM_PREVIEW_DURATION,
  FILM_PREVIEW_FPS,
  FILM_PREVIEW_HEIGHT,
  FILM_PREVIEW_WIDTH,
} from "./AiFilmPreview";
import { SHOWCASE_DURATION, SHOWCASE_FPS, SHOWCASE_HEIGHT, SHOWCASE_WIDTH } from "./constants";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="EdtechraShowcase"
        component={EdtechraShowcase}
        durationInFrames={SHOWCASE_DURATION}
        fps={SHOWCASE_FPS}
        width={SHOWCASE_WIDTH}
        height={SHOWCASE_HEIGHT}
        defaultProps={{}}
      />
      <Composition
        id="AiFilmPreview"
        component={AiFilmPreview}
        durationInFrames={FILM_PREVIEW_DURATION}
        fps={FILM_PREVIEW_FPS}
        width={FILM_PREVIEW_WIDTH}
        height={FILM_PREVIEW_HEIGHT}
        defaultProps={{}}
      />
    </>
  );
}
