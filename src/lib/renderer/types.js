    /** @typedef {'participant'|'organizer'|'mentor'|'volunteer'} Role */
    export const ROLES = ['participant', 'organizer', 'mentor', 'volunteer'];
    
    /**
     * Fields every layer has.
     * @typedef {Object} LayerBase
     * @property {string} id            unique name inside the template
     * @property {number} x             left edge
     * @property {number} y             top edge
     * @property {number} w             width
     * @property {number} h             height
     * @property {boolean} [optional]   true = if data is missing, skip silently (no warning)
     * @property {string} [hideIfEmpty] name of a field; if it is empty, hide this layer
     */
    
    /**
     * @typedef {LayerBase & {type:'rect', fill:string, radius?:number}} RectLayer
     *   fill may be a color like "#ff0000" or "$role" (= this person's role color)
     *
     * @typedef {LayerBase & {type:'text', text:string, font:string, size:number,
     *   minSize?:number, weight?:number, color:string, align?:'left'|'center'|'right',
     *   maxLines?:number, lineHeight?:number, uppercase?:boolean}} TextLayer
     *   text may contain placeholders like "{{name}}"
     *
     * @typedef {LayerBase & {type:'image', src:string, fit:'contain'|'cover',
     *   shape?:'rect'|'circle', fallback?:'initials'|'none',
     *   align?:'left'|'center'|'right'}} ImageLayer
     *   src is "{{photo}}" or "{{logo}}". contain = keep proportions (logos),
     *   cover = fill and crop (photos).
     *   align: for logos, which side of the box the logo hugs (default center)
     *
     * @typedef {LayerBase & {type:'qr', value:string}} QrLayer      (Task 5)
     *
     * @typedef {LayerBase & {type:'badge', text:string, fill:string, color:string,
     *   size:number, font?:string, weight?:number, radius?:number}} BadgeLayer
     *
     * @typedef {RectLayer|TextLayer|ImageLayer|QrLayer|BadgeLayer} Layer
     *
     * @typedef {Object} Template
     * @property {string} id
     * @property {string} name
     * @property {1} version
     * @property {{width:number,height:number,background:string}} canvas
     * @property {Record<Role,string>} roleColors
     * @property {Layer[]} layers     drawn in order: first = bottom, last = top
     */
    
    /**
     * Data for ONE card, e.g. { name: "Asha", role: "mentor", photo: "data:image/..." }
     * @typedef {Record<string, string|undefined>} CardData
     */
    
    /**
     * A problem found while rendering. Task 12 (pre-flight) reads these.
     * kind: 'missing' (no data), 'overflow' (text had to be cut), 'unsupported' (layer type not drawn)
     * @typedef {{layerId:string, kind:'missing'|'overflow'|'unsupported', field?:string}} Warning
     */
    
    /** @typedef {{svg:string, warnings:Warning[]}} RenderResult */