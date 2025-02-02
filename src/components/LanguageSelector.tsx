'use client';

import { Theme, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Chip from '@mui/material/Chip';
import { LANGUAGES } from '@/config/languages';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/useStore';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function getStyles(name: string, selectedLangs: string[], theme: Theme) {
  return {
    fontWeight:
      selectedLangs.indexOf(name) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

export default function LanguageSelector() {
  const { languages, setLanguages } = useStore();
  const theme = useTheme();
  const t = useTranslations();

  const handleChange = (event: SelectChangeEvent<typeof languages>) => {
    const {
      target: { value },
    } = event;
    setLanguages(typeof value === 'string' ? value.split(',') : value);
  };

  return (
    <div className="relative mx-auto mb-8 text-center">
      <FormControl sx={{ m: 1, width: 300 }}>
        <InputLabel id="language-select-label">{t('iSpeak')}</InputLabel>
        <Select
          labelId="language-select-label"
          id="language-select"
          multiple
          value={languages}
          onChange={handleChange}
          input={<OutlinedInput label={t('iSpeak')} />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((value) => (
                <Chip 
                  key={value} 
                  label={LANGUAGES.find(lang => lang.code === value)?.name}
                  onDelete={() => {
                    setLanguages(prev => prev.filter(lang => lang !== value));
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                />
              ))}
            </Box>
          )}
          MenuProps={{
            ...MenuProps,
            PaperProps: {
              ...MenuProps.PaperProps,
              style: {
                ...MenuProps.PaperProps.style,
                marginTop: 8
              }
            }
          }}
        >
          {LANGUAGES.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              <Checkbox checked={languages.indexOf(lang.code) > -1} />
              <ListItemText primary={lang.name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
} 