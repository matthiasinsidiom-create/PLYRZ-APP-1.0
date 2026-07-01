import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generatePlayerCard(frameBase64: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: frameBase64,
            mimeType: "image/png",
          },
        },
        {
          text: `Fill the uploaded football card frame exactly without redesigning it.

Do not change the uploaded frame in any way.
Do not create a new card design.
Do not change the border, banner, lighting, texture, or card shape.

Place the elements in these exact regions:

1. OVERALL RATING
- top left corner
- large bold number "91"
- aligned vertically near the left margin

2. POSITION
- directly below overall
- smaller bold text "ST"

3. FLAG
- directly below position
- left side column
- France flag

4. CLUB LOGO
- directly below flag
- left side column
- Real Madrid logo

5. PLAYER PORTRAIT
- centered
- face and upper torso visible
- large portrait of Kylian Mbappé occupying the middle of the card
- portrait should extend slightly into the banner zone

6. PLAYER NAME
- centered inside the black horizontal banner
- uppercase "MBAPPÉ"
- bold

7. STATS
Bottom area only
2 balanced columns

Left:
97 TEM
90 SCH
80 PAS

Right:
92 DRI
36 DEF
78 PHY

Use bold sports card typography.
Maintain equal spacing.
Preserve exact uploaded frame.
No creativity, no redesign, no changes.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    }
  });

  return response;
}
