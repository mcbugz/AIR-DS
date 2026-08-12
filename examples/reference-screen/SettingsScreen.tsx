import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Dialog,
  Radio,
  RadioGroup,
  Switch,
  TextArea,
  TextField,
} from '@ds/react';
import styles from './SettingsScreen.module.css';

export interface SettingsScreenProps {
  /** Called after the user confirms workspace deletion in the dialog. */
  onDeleteWorkspace?: () => void;
}

/**
 * Workspace settings reference screen.
 *
 * Composition follows the build-screen skill: registry components from
 * `@ds/react` only, layout via plain semantic HTML + CSS Module classes
 * that consume `var(--ds-*)` tokens exclusively.
 */
export function SettingsScreen({ onDeleteWorkspace }: SettingsScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [digest, setDigest] = useState('weekly');

  return (
    <main className={styles.settingsScreen}>
      <div className={styles.column}>
        <header>
          <h1 className={styles.pageTitle}>Workspace settings</h1>
          <p className={styles.pageSubtitle}>
            Manage how this workspace appears and how it notifies your team.
          </p>
        </header>

        <div className={styles.sections}>
          {/* Profile */}
          <Card elevation="raised">
            <CardHeader>
              <h2 className={styles.sectionTitle}>Profile</h2>
            </CardHeader>
            <CardBody>
              <div className={styles.fieldStack}>
                <TextField
                  label="Display name"
                  description="Shown to members everywhere this workspace appears."
                  placeholder="Acme Inc."
                  value={displayName}
                  onChange={setDisplayName}
                />
                <TextArea
                  label="Bio"
                  description="A short description of what this workspace is for."
                  placeholder="Tell your team what happens here…"
                  rows={4}
                  autoGrow
                  value={bio}
                  onChange={setBio}
                />
              </div>
            </CardBody>
            <CardFooter>
              <div className={styles.actionsEnd}>
                <Button onPress={() => {}}>Save changes</Button>
              </div>
            </CardFooter>
          </Card>

          {/* Notifications */}
          <Card elevation="raised">
            <CardHeader>
              <h2 className={styles.sectionTitle}>Notifications</h2>
            </CardHeader>
            <CardBody>
              <div className={styles.fieldStack}>
                <div className={styles.toggleStack}>
                  <Switch isSelected={emailEnabled} onChange={setEmailEnabled}>
                    Email notifications
                  </Switch>
                  <Switch isSelected={pushEnabled} onChange={setPushEnabled}>
                    Push notifications
                  </Switch>
                </div>
                <RadioGroup
                  label="Digest frequency"
                  description="How often we bundle activity into a summary email."
                  value={digest}
                  onChange={setDigest}
                >
                  <Radio value="daily">Daily</Radio>
                  <Radio value="weekly">Weekly</Radio>
                  <Radio value="never">Never</Radio>
                </RadioGroup>
              </div>
            </CardBody>
          </Card>

          {/* Danger zone */}
          <Card elevation="raised">
            <CardHeader>
              <h2 className={styles.sectionTitle}>Danger zone</h2>
            </CardHeader>
            <CardBody>
              <div className={styles.fieldStack}>
                <Alert tone="danger" title="Deleting a workspace is permanent">
                  All projects, members, integrations, and settings in this
                  workspace will be removed. This cannot be undone.
                </Alert>
                <div className={styles.actionsStart}>
                  <Dialog
                    title="Delete workspace"
                    size="sm"
                    trigger={<Button variant="danger">Delete workspace…</Button>}
                  >
                    {({ close }) => (
                      <div className={styles.dialogBody}>
                        <p className={styles.dialogText}>
                          This permanently deletes the workspace and everything
                          in it. There is no way to recover it afterwards.
                        </p>
                        <div className={styles.actionsEnd}>
                          <Button variant="secondary" onPress={close}>
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            onPress={() => {
                              onDeleteWorkspace?.();
                              close();
                            }}
                          >
                            Delete workspace
                          </Button>
                        </div>
                      </div>
                    )}
                  </Dialog>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  );
}
