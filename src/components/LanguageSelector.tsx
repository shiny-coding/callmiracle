'use client';

import { Theme, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Chip from '@mui/material/Chip';
import { LANGUAGES } from '@/config/languages';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { useTranslations } from 'next-intl';
import { FormGroup, Typography } from '@mui/material';

interface LanguageSelectorProps {
  value: string[];
  onChange: (languages: string[]) => void;
  label?: string;
  availableLanguages?: string[];
}

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

export default function LanguageSelector({ value, onChange, label, availableLanguages }: LanguageSelectorProps) {
  const t = useTranslations('Profile');

  const handleChange = (event: SelectChangeEvent<typeof value>) => {
    const {
      target: { value: newValue },
    } = event;
    onChange(typeof newValue === 'string' ? newValue.split(',') : newValue);
  };

  // Filter LANGUAGES if availableLanguages is provided
  const filteredLanguages = availableLanguages && availableLanguages.length > 0
    ? LANGUAGES.filter(lang => availableLanguages.includes(lang.code))
    : LANGUAGES;

  return (
    <FormGroup className="">
      {label && (
        <Typography variant="subtitle1" className="mb-2">
          {label}
        </Typography>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <FormControl sx={{ m: 1, width: 300 }}>
          <Select
            id="language-select"
            multiple
            value={value}
            onChange={handleChange}
            input={<OutlinedInput />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((langCode) => (
                  <Chip 
                    key={langCode} 
                    label={LANGUAGES.find(lang => lang.code === langCode)?.name}
                    onDelete={() => { onChange(selected.filter(code => code !== langCode)); }}
                    onMouseDown={(event) => { event.stopPropagation(); }}
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
            {filteredLanguages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Checkbox checked={value.indexOf(lang.code) > -1} />
                <ListItemText primary={lang.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
    </FormGroup>
  );
} 