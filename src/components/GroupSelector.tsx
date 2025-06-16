'use client';

import { Theme, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { useTranslations } from 'next-intl';
import { FormGroup, Typography } from '@mui/material';
import { Group } from '@/generated/graphql';

interface GroupSelectorProps {
  value: string[];
  onChange: (groupIds: string[]) => void;
  label?: string;
  availableGroups: Group[];
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

function getStyles(name: string, selectedGroups: string[], theme: Theme) {
  return {
    fontWeight:
      selectedGroups.indexOf(name) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

export default function GroupSelector({ value, onChange, label, availableGroups }: GroupSelectorProps) {
  const t = useTranslations();

  const handleChange = (event: SelectChangeEvent<typeof value>) => {
    const {
      target: { value: newValue },
    } = event;
    onChange(typeof newValue === 'string' ? newValue.split(',') : newValue);
  };

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
            id="group-select"
            multiple
            value={value}
            onChange={handleChange}
            input={<OutlinedInput />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((groupId) => (
                  <Chip 
                    key={groupId} 
                    label={availableGroups.find(group => group._id === groupId)?.name || groupId}
                    onDelete={() => { onChange(selected.filter(id => id !== groupId)); }}
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
            {availableGroups.map((group) => (
              <MenuItem key={group._id} value={group._id}>
                <Checkbox checked={value.indexOf(group._id) > -1} />
                <ListItemText primary={group.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
    </FormGroup>
  );
} 