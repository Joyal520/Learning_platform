const LOGO_BASE_PATH = "/assets/logos/";

export const EdTechraBrandAssets = Object.freeze({
    alt: "Edtechra",
    logos: Object.freeze({
        horizontalLight: `${LOGO_BASE_PATH}edtechra-logo-light.png`,
        darkBackground: `${LOGO_BASE_PATH}edtechra-logo-dark.png`,
        icon: `${LOGO_BASE_PATH}edtechra-icon-light.png`,
        iconAlt: `${LOGO_BASE_PATH}edtechra-icon-dark.png`,
        slogan: `${LOGO_BASE_PATH}edtechra-logo-light.png`,
        pwa: `${LOGO_BASE_PATH}edtechra-icon-light.png`
    })
});

if (typeof window !== "undefined") {
    window.EdTechraBrandAssets = EdTechraBrandAssets;
}
