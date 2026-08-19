import * as React from 'react';
import { Button } from './Button';

/** Legacy hand-rolled story file (pre-CSF3 house style). */
export default {
  title: 'Atlas/Button',
  component: Button,
};

export const Primary = () => <Button variant="primary">Save</Button>;
export const Secondary = () => <Button variant="secondary">Cancel</Button>;
export const Danger = () => <Button variant="danger">Delete</Button>;
