export const NODE_COLORS = {
  dark: {
    Mine: '#FF6F00',
    Refinery: '#FFEA00',
    ComponentMfg: '#39FF14',
    CellMfg: '#00E5FF',
    PackAssembly: '#FF00FF',
    OEM: '#FF003C',
    RiskZone: '#FF003C',
  },
  light: {
    Mine: '#A8A8A8',
    Refinery: '#D0D0D0',
    ComponentMfg: '#787878',
    CellMfg: '#606060',
    PackAssembly: '#909090',
    OEM: '#B0B0B0',
    RiskZone: '#FF4444',
  },
};

export const CRITICAL_COLOR = {
  dark: '#FF003C',
  light: '#FF4444',
};

export const WARNING_COLOR = {
  dark: '#FF6F00',
  light: '#FF8844',
};

export const NODE_LABELS = {
  Mine: 'MINE',
  Refinery: 'REF',
  ComponentMfg: 'COMP',
  CellMfg: 'CELL',
  PackAssembly: 'PACK',
  OEM: 'OEM',
  RiskZone: 'RZ',
};

export const NODE_ICONS = {
  Mine: '\u26CF',
  Refinery: '\u2697',
  ComponentMfg: '\u2699',
  CellMfg: '\u{1F50B}',
  PackAssembly: '\u{1F4E6}',
  OEM: '\u{1F697}',
  RiskZone: '\u26A0',
};

export const NODE_SIZES = {
  RiskZone: 14,
  OEM: 13,
  PackAssembly: 12,
  CellMfg: 11,
  ComponentMfg: 10,
  Refinery: 9,
  Mine: 8,
};

export const NODE_DISPLAY_PROPERTY = {
  Mine: 'name',
  Refinery: 'name',
  ComponentMfg: 'name',
  CellMfg: 'name',
  PackAssembly: 'name',
  OEM: 'name',
  RiskZone: 'zone_id',
};

export const EDGE_COLORS = {
  dark: {
    SUPPLIES_TO: 'rgba(0, 229, 255, 0.5)',
    CRITICAL_PATH: '#FF003C',
    IDENTIFIED_IN: '#CC0030',
  },
  light: {
    SUPPLIES_TO: 'rgba(100, 110, 160, 0.6)',
    CRITICAL_PATH: '#FF4444',
    IDENTIFIED_IN: '#CC3333',
  },
};
