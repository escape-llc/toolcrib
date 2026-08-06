import React, { useState } from 'react';
import { z } from 'zod';
import { useTheme } from './theme/themeContext';
import { ThemeEditor } from './components/ThemeEditor/ThemeEditor';
import { Card } from './components/Card/Card';
import { Form } from './components/Form/FormContext';
import { FormField, FormError, Input, Checkbox, Switch, Textarea, Button, SubmitButton, RadioGroup } from './components/Form/FormComponents';
import { Popup } from './components/Overlay/Popup';
import { SlideOut } from './components/Overlay/SlideOut';
import { Modal } from './components/Overlay/Modal';
import { useToast } from './components/Toast/ToastContext';
import { DataTable, Column } from './components/DataTable/DataTable';
import { TabStrip } from './components/TabStrip/TabStrip';
import { UIGroup } from './components/UIGroup/UIGroup';
import { Splitter } from './components/Splitter/Splitter';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Accordion } from './components/Accordion/Accordion';
import { DropdownMenu } from './components/DropdownMenu/DropdownMenu';
import { Select } from './components/Form/Select';
import { Slider } from './components/Form/Slider';
import { Toolbar } from './components/Toolbar/Toolbar';
import { VStack, HStack } from './components/Layout/Stack';
import { Grid } from './components/Layout/Grid';
import { aiBus } from './eventBus/eventBus';
import { useAIEvent } from './eventBus/useAIEvent';

// Zod validation schema for Demo Form
const userProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'editor', 'viewer'], { required_error: 'Role is required' }),
  contactPref: z.enum(['email', 'sms', 'phone'], { required_error: 'Select a contact preference' }),
  notifications: z.boolean(),
  agreeTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
  bio: z.string().max(200, 'Bio cannot exceed 200 characters').optional(),
});

interface DemoUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Pending' | 'Inactive';
  score: number;
}

const dummyUsers: DemoUser[] = Array.from({ length: 250 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 3 === 0 ? 'Admin' : i % 2 === 0 ? 'Editor' : 'Viewer',
  status: i % 4 === 0 ? 'Pending' : i % 5 === 0 ? 'Inactive' : 'Active',
  score: Math.floor(Math.random() * 100),
}));

export const App: React.FC = () => {
  const { parameters } = useTheme();
  const { addToast, setAnchor } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'form' | 'overlays' | 'toasts' | 'datatable' | 'layout' | 'showcase'>('overview');
  const [eventLogs, setEventLogs] = useState<{ id: string; event: string; payload: string; time: string }[]>([]);
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);

  // Subscribe to ALL aiBus events for the live event monitor
  useAIEvent('*' as any, (event: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const eventName = event.type || 'aiBus:event';
    const logItem = {
      id: Math.random().toString(36).substring(2, 9),
      event: eventName,
      payload: JSON.stringify(event.detail || event),
      time: timestamp,
    };
    setEventLogs(prev => [logItem, ...prev.slice(0, 49)]);
  });

  const columns: Column<DemoUser>[] = [
    { key: 'id', title: 'ID', width: 60, sortable: true },
    { key: 'name', title: 'User Name', width: 140, sortable: true },
    { key: 'email', title: 'Email Address', width: 220, sortable: true },
    { key: 'role', title: 'Role Level', width: 110, sortable: true },
    {
      key: 'status',
      title: 'Status',
      width: 110,
      sortable: true,
      render: (val) => (
        <span
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--ai-radius-sm, 0.25rem)',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: val === 'Active' ? 'var(--ai-subtheme-success-bg)' : val === 'Pending' ? 'var(--ai-subtheme-warning-bg)' : 'var(--ai-subtheme-error-bg)',
            color: val === 'Active' ? 'var(--ai-subtheme-success-text)' : val === 'Pending' ? 'var(--ai-subtheme-warning-text)' : 'var(--ai-subtheme-error-text)',
            border: `0.0625rem solid ${val === 'Active' ? 'var(--ai-subtheme-success-border)' : val === 'Pending' ? 'var(--ai-subtheme-warning-border)' : 'var(--ai-subtheme-error-border)'}`,
          }}
        >
          {val}
        </span>
      ),
    },
    { key: 'score', title: 'Score', width: 90, sortable: true },
  ];

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ai-bg-primary)', color: 'var(--ai-text-primary)' }}>
      {/* Top Header Bar */}
      <header style={{ padding: '0.75rem 1.5rem', background: 'var(--ai-bg-surface)', borderBottom: '0.0625rem solid var(--ai-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '1.5rem' }}>🤖</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>AI-UI Toolkit</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>
              React UI Component Package Tailored for AI Consumption (Master Font: {parameters.masterFontSize}px)
            </p>
          </div>
        </div>

        <UIGroup style={{ height: '2.375rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem 0.875rem',
              background: 'var(--ai-bg-container, #f9fafb)',
              border: '0.0625rem solid var(--ai-border, #d1d5db)',
              fontSize: '0.875rem',
              color: 'var(--ai-text-secondary, #6b7280)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>
              Harmony: <strong style={{ color: 'var(--ai-text-primary)' }}>{parameters.harmonyMode}</strong> | Mode: <strong style={{ color: 'var(--ai-text-primary)' }}>{parameters.isDarkMode ? 'Dark 🌙' : 'Light ☀️'}</strong> | Padding: <strong style={{ color: 'var(--ai-text-primary)' }}>{parameters.paddingMode}</strong> | Radius: <strong style={{ color: 'var(--ai-text-primary)' }}>{parameters.cornerRadiusMode}</strong>
            </span>
          </div>
          <ThemeEditor
            isOpen={isThemeEditorOpen}
            onOpenChange={setIsThemeEditorOpen}
            trigger={<Button variant="primary">🎨 OOTB Theme Designer</Button>}
          />
        </UIGroup>
      </header>

      {/* Main Content Area with Resizable Splitter */}
      <main style={{ flex: '1 1 0px', width: '100%', minHeight: 0, overflow: 'hidden', padding: '1rem' }}>
        <Splitter orientation="vertical" initialSplit={70}>
          {/* Top Panel: Interactive Component Playground */}
          <Splitter.Panel squareCorners="bottom">
            <div style={{ height: '100%', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
              <TabStrip
                activeId={activeTab}
                onChange={id => setActiveTab(id as any)}
                items={[
                  { id: 'overview', label: '🚀 Overview & Architecture' },
                  { id: 'form', label: '📝 Form & Zod Engine' },
                  { id: 'overlays', label: '🪟 Overlays (Popup / SlideOut / Modal)' },
                  { id: 'toasts', label: '🔔 Toast Subsystem' },
                  { id: 'datatable', label: '📊 Virtualized Data Table' },
                  { id: 'layout', label: '📐 Common Layout Idioms' },
                  { id: 'showcase', label: '🧩 Component Showcase' },
                ]}
              />

              {/* Scrollable Content Container for Active Tab */}
              <div key={activeTab} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'var(--ai-tab-panel-animation, ai-fade-in 0.22s ease)' }}>
                {/* Tab 1: Overview & Architecture */}
                {activeTab === 'overview' && (
                  <VStack gap="lg">
                    <Grid columns={2} gap="lg">
                      <Card>
                        <Card.Header>⚡ Why Use Radix UI Primitives Underneath?</Card.Header>
                        <Card.Content style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
                          <p style={{ marginTop: 0 }}>
                            By wrapping Radix UI primitives (`@radix-ui/react-*`), <code>AI-UI</code> decouples robust WAI-ARIA accessibility, keyboard navigation, focus trapping, and light-dismiss from design system styling.
                          </p>
                          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                            <li><strong>Dialog (`Modal`)</strong>: Full focus trap & background lockout.</li>
                            <li><strong>Popover (`Popup`)</strong>: Trigger anchoring & escape dismiss.</li>
                            <li><strong>Toast (`Toast`)</strong>: Priority queueing & sticky user actions.</li>
                            <li><strong>Tabs (`TabStrip`)</strong>: Arrow key focus traversal.</li>
                            <li><strong>RadioGroup, Checkbox, Switch</strong>: Accessible form controls.</li>
                          </ul>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>🧩 Why Use Common Layout Idioms & Theme Slices?</Card.Header>
                        <Card.Content style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
                          <p style={{ marginTop: 0 }}>
                            Traditional LLM code generation often suffers from ad-hoc CSS clutter (`p-1`, `mb-4`, hardcoded pixels). <code>AI-UI</code> solves this by giving the AI high-level layout idioms:
                          </p>
                          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                            <li><strong><code>&lt;VStack&gt;</code> & <code>&lt;HStack&gt;</code></strong>: Self-spacing vertical & horizontal flex containers.</li>
                            <li><strong><code>&lt;Grid&gt;</code></strong>: Multi-column responsive card grids.</li>
                            <li><strong><code>&lt;Toolbar&gt;</code></strong>: Header action bars with <code>Left</code>, <code>Center</code>, and <code>Right</code> slots.</li>
                            <li><strong><code>ThemeSlice</code> Engine</strong>: Pluggable design capabilities (<code>margin</code>, <code>padding</code>, <code>radius</code>, <code>shadow</code>, <code>table</code>).</li>
                          </ul>
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>📐 AI Schema & rem Scaling Engine</Card.Header>
                      <Card.Content style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
                        <p style={{ marginTop: 0 }}>
                          In <code>AI-UI</code>, all component dimensions, paddings, gaps, and font sizes are calculated in <code>rem</code> units.
                          Changing the <strong>Master Font Size</strong> slider in the OOTB Theme Designer updates <code>--ai-master-font-size</code> on <code>:root</code>, smoothly scaling the entire UI layout up or down in real time!
                        </p>
                        <pre style={{ background: 'var(--ai-bg-container)', padding: '0.75rem', borderRadius: 'var(--ai-radius-md, 0.375rem)', fontSize: '0.75rem', overflowX: 'auto', margin: 0 }}>
{`:root {
  font-size: var(--ai-master-font-size, 16px);
  --ai-padding-md: 0.5rem 1rem;
  --ai-margin-gap: 0.875rem;
  --ai-table-cell-padding: var(--ai-padding-sm);
}`}
                        </pre>
                      </Card.Content>
                    </Card>
                  </VStack>
                )}

                {/* Tab 2: Form & Zod Engine */}
                {activeTab === 'form' && (
                  <Grid columns={2} gap="lg">
                    <Card>
                      <Card.Header>User Profile Form (Zod 4 Validated Engine)</Card.Header>
                      <Card.Content>
                        <Form
                          id="profile-form"
                          schema={userProfileSchema}
                          initialValues={{ username: '', email: '', role: 'editor', contactPref: 'email', notifications: true, agreeTerms: false }}
                          onSubmit={values => {
                            addToast({ type: 'success', message: `User ${values.username} created successfully! (Contact: ${values.contactPref})` });
                          }}
                        >
                          <FormField name="username" label="Username" helperText="Unique username handle">
                            <Input placeholder="johndoe" />
                          </FormField>

                          <FormField name="email" label="Email Address">
                            <Input type="email" placeholder="john@example.com" />
                          </FormField>

                          <FormField name="role" label="Role Level">
                            <Select
                              options={[
                                { label: 'Administrator', value: 'admin' },
                                { label: 'Content Editor', value: 'editor' },
                                { label: 'Viewer Only', value: 'viewer' },
                              ]}
                            />
                          </FormField>

                          <FormField name="contactPref" label="Preferred Contact Method">
                            <RadioGroup
                              name="contactPref"
                              direction="horizontal"
                              options={[
                                { label: 'Email', value: 'email' },
                                { label: 'SMS Text', value: 'sms' },
                                { label: 'Phone Call', value: 'phone' },
                              ]}
                            />
                          </FormField>

                          <FormField name="notifications">
                            <Switch name="notifications" label="Enable Email Notifications" />
                          </FormField>

                          <FormField name="agreeTerms">
                            <Checkbox name="agreeTerms" label="I agree to terms and conditions" />
                          </FormField>

                          <FormField name="bio" label="Short Bio (Optional)">
                            <Textarea placeholder="Tell us about yourself..." />
                          </FormField>

                          <FormError />

                          <Card.Actions>
                            <SubmitButton>Save Profile</SubmitButton>
                          </Card.Actions>
                        </Form>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Form Architecture & Validation Features</Card.Header>
                      <Card.Content style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
                        <p style={{ marginTop: 0 }}>
                          The <code>Form</code> component provides automatic Zod 4 schema validation, field registration, error layout, and touched field tracking without prop-drilling.
                        </p>
                        <VStack gap="sm">
                          <div style={{ padding: '0.75rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)' }}>
                            <strong>Strongly-Typed Event Bus:</strong> Form submission and error states automatically emit <code>form:submitted</code> and <code>form:errored</code> events.
                          </div>
                          <div style={{ padding: '0.75rem', background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-sm)' }}>
                            <strong>Theme Spacing:</strong> Every <code>&lt;FormField&gt;</code> automatically applies <code>marginBottom: var(--ai-margin-gap)</code>.
                          </div>
                        </VStack>
                      </Card.Content>
                    </Card>
                  </Grid>
                )}

                {/* Tab 3: Overlays */}
                {activeTab === 'overlays' && (
                  <Grid columns={3} gap="lg">
                    <Card>
                      <Card.Header>Popup Container (Popover)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Anchored contextual popup container with light dismiss.</p>
                        <Popup
                          id="demo-popup"
                          trigger={<Button variant="outline">Toggle Popup Menu</Button>}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.875rem' }}>Account Quick Info</strong>
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>User: john_doe@example.com</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>Role: Administrator</p>
                            <Button size="sm" variant="primary" onClick={() => aiBus.emit('popup:hidden', { id: 'demo-popup' })}>Dismiss</Button>
                          </div>
                        </Popup>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>SlideOut Drawer</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Side drawer sliding in from screen edge with backdrop and light dismiss.</p>
                        <SlideOut
                          id="demo-slideout"
                          title="Application Details Drawer"
                          trigger={<Button variant="secondary">Open SlideOut Drawer</Button>}
                        >
                          <p>This drawer is decoupled and easily controlled by AI.</p>
                          <Button variant="danger" onClick={() => aiBus.emit('slideout:hidden', { id: 'demo-slideout' })}>Close Drawer</Button>
                        </SlideOut>
                      </Card.Content>
                    </Card>

                    <Card>
                      <Card.Header>Modal Dialog (Focus Trap)</Card.Header>
                      <Card.Content>
                        <p style={{ marginTop: 0 }}>Modal dialog with complete focus lock out (`aria-modal`) and background lockout.</p>
                        <Modal trigger={<Button variant="primary">Open Modal Dialog</Button>}>
                          <Modal.Header>Confirm Account Action</Modal.Header>
                          <Modal.Body>
                            Are you sure you want to perform this action? Keyboard navigation (Tab) is trapped safely inside this dialog.
                          </Modal.Body>
                          <Modal.Footer>
                            <Modal.Actions>
                              <UIGroup>
                                <Modal.CloseButton />
                                <Button variant="danger" onClick={() => { addToast({ type: 'success', message: 'Action confirmed!' }); }}>Confirm</Button>
                              </UIGroup>
                            </Modal.Actions>
                          </Modal.Footer>
                        </Modal>
                      </Card.Content>
                    </Card>
                  </Grid>
                )}

                {/* Tab 4: Toasts */}
                {activeTab === 'toasts' && (
                  <Card>
                    <Card.Header>Toast Subsystem Controls</Card.Header>
                    <Card.Content style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <p style={{ marginTop: 0 }}>Dispatch notifications via <code>useToast()</code> or cross-tree via <code>aiBus.emit('toast:shown', ...)</code>.</p>
                      <UIGroup>
                        <Button variant="primary" onClick={() => aiBus.showToast('Informational message', 'info')}>
                          Fire Info Toast
                        </Button>
                        <Button subtheme="success" onClick={() => aiBus.showToast('Success notification!', 'success', 'high')}>
                          Fire Success Toast
                        </Button>
                        <Button subtheme="warning" onClick={() => aiBus.showToast('Warning: Check parameters', 'warning', 'high')}>
                          Fire Warning Toast
                        </Button>
                        <Button subtheme="error" onClick={() => aiBus.showToast('Critical System Failure', 'error', 'urgent')}>
                          Fire Urgent Error Toast
                        </Button>
                      </UIGroup>

                      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Toast Anchor Position:</span>
                        <select
                          onChange={e => setAnchor(e.target.value as any)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            borderRadius: 'var(--ai-radius-md, 0.375rem)',
                            border: '0.0625rem solid var(--ai-border)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-center">Top Center</option>
                          <option value="bottom-center">Bottom Center</option>
                        </select>
                      </div>
                    </Card.Content>
                  </Card>
                )}

                {/* Tab 5: Virtualized Data Table */}
                {activeTab === 'datatable' && (
                  <Card layout="auto" style={{ height: '100%', minHeight: 0 }}>
                    <Card.Header>
                      <Toolbar>
                        <Toolbar.Left>
                          <span>Virtualized Data Table (250 Rows, Adaptive Rem Height)</span>
                        </Toolbar.Left>
                        <Toolbar.Right>
                          <Button size="sm" variant="outline" icon="📊" onClick={() => addToast({ type: 'info', message: 'Table exported!' })}>Export CSV</Button>
                        </Toolbar.Right>
                      </Toolbar>
                    </Card.Header>
                    <Card.Content layout="auto" style={{ padding: '0.75rem' }}>
                      <DataTable
                        data={dummyUsers}
                        columns={columns}
                        pageSize={15}
                        pageSizeOptions={[5, 10, 15, 25, 50]}
                        containerHeight="auto"
                        rowKey={rec => rec.id}
                      />
                    </Card.Content>
                  </Card>
                )}

                {/* Tab 6: Common Layout Idioms (NEW) */}
                {activeTab === 'layout' && (
                  <VStack gap="lg">
                    <Grid columns={2} gap="lg">
                      <Card>
                        <Card.Header>Vertical & Horizontal Stacks (`&lt;VStack&gt;` & `&lt;HStack&gt;`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>Self-spacing flex containers that automatically apply theme <code>--ai-margin-gap</code> spacing.</p>
                          <VStack gap="md" style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-md)' }}>
                            <div style={{ background: 'var(--ai-bg-surface)', padding: '0.75rem', borderRadius: 'var(--ai-radius-sm)', fontWeight: 600 }}>VStack Item 1</div>
                            <div style={{ background: 'var(--ai-bg-surface)', padding: '0.75rem', borderRadius: 'var(--ai-radius-sm)', fontWeight: 600 }}>VStack Item 2</div>
                            <HStack justify="between" style={{ background: 'var(--ai-bg-surface)', padding: '0.75rem', borderRadius: 'var(--ai-radius-sm)' }}>
                              <span style={{ fontWeight: 600 }}>HStack Left Item</span>
                              <Button size="sm" variant="primary">HStack Right Action</Button>
                            </HStack>
                          </VStack>
                        </Card.Content>
                      </Card>

                      <Card>
                        <Card.Header>Multi-Column Responsive Grids (`&lt;Grid&gt;`)</Card.Header>
                        <Card.Content>
                          <p style={{ marginTop: 0 }}>Responsive grid containers that consume <code>--ai-margin-gap</code> spacing without pixel calculations.</p>
                          <Grid columns={2} gap="md">
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 1
                            </div>
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 2
                            </div>
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 3
                            </div>
                            <div style={{ background: 'var(--ai-bg-container)', padding: '1rem', borderRadius: 'var(--ai-radius-sm)', textAlign: 'center', fontWeight: 600 }}>
                              Grid Column 4
                            </div>
                          </Grid>
                        </Card.Content>
                      </Card>
                    </Grid>

                    <Card>
                      <Card.Header>Action Toolbars with Slot Architecture (`&lt;Toolbar&gt;`)</Card.Header>
                      <Card.Content>
                        <VStack gap="md">
                          <p style={{ marginTop: 0 }}>Toolbars with explicit <code>Left</code>, <code>Center</code>, and <code>Right</code> slots prevent AI from writing ad-hoc flex styles.</p>
                          <div style={{ background: 'var(--ai-bg-container)', padding: '0.75rem 1rem', borderRadius: 'var(--ai-radius-md)' }}>
                            <Toolbar>
                              <Toolbar.Left>
                                <strong>Toolbar Title Left</strong>
                              </Toolbar.Left>
                              <Toolbar.Center>
                                <Button size="sm" variant="outline">Center Tab 1</Button>
                                <Button size="sm" variant="outline">Center Tab 2</Button>
                              </Toolbar.Center>
                              <Toolbar.Right>
                                <Button size="sm" variant="primary" icon="⚡">Action Right</Button>
                              </Toolbar.Right>
                            </Toolbar>
                          </div>
                        </VStack>
                      </Card.Content>
                    </Card>
                  </VStack>
                )}

                {/* Tab 7: Component Showcase */}
                {activeTab === 'showcase' && (
                  <VStack gap="lg">
                    {/* Section 1: Button Variants & Subthemes */}
                    <Card>
                      <Card.Header>Button Subsystem (Variants, Sub-Themes & Glyphs)</Card.Header>
                      <Card.Content style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <Button variant="primary" icon="🚀" trailingIcon="➔" onClick={() => addToast({ type: 'info', message: 'Primary Button clicked!', priority: 'medium' })}>Primary Launch</Button>
                          <Button variant="secondary" icon="⚙️" onClick={() => addToast({ type: 'info', message: 'Secondary Button clicked!', priority: 'low' })}>Secondary Settings</Button>
                          <Button variant="outline" icon="⚡" onClick={() => addToast({ type: 'info', message: 'Outline Button clicked!', priority: 'medium' })}>Outline Action</Button>
                          <Button variant="danger" icon="🗑️" onClick={() => addToast({ type: 'error', message: 'Danger Button clicked!', priority: 'urgent' })}>Delete Record</Button>
                          <Button variant="ghost" icon="⭐" onClick={() => addToast({ type: 'info', message: 'Ghost Button clicked!', priority: 'low' })}>Favorite</Button>
                          <Button subtheme="success" icon="✅" onClick={() => addToast({ type: 'success', message: 'Success Subtheme Button clicked!', priority: 'medium' })}>Success Verified</Button>
                          <Button subtheme="warning" icon="⚠️" onClick={() => addToast({ type: 'warning', message: 'Warning Subtheme Button clicked!', priority: 'high' })}>Warning Alert</Button>
                          <Button subtheme="info" icon="ℹ️" onClick={() => addToast({ type: 'info', message: 'Info Subtheme Button clicked!', priority: 'medium' })}>Info Details</Button>
                        </div>
                      </Card.Content>
                    </Card>

                    {/* Section 2: Adaptive Card Layout & Groups */}
                    <Grid columns={2} gap="lg">
                      <Card layout="auto" style={{ height: '18rem' }}>
                        <Card.Header>Adaptive Card (`layout="auto"`)</Card.Header>
                        <Card.Content layout="auto">
                          <p style={{ marginTop: 0 }}>
                            When <code>layout="auto"</code> is passed to <code>&lt;Card&gt;</code> and <code>&lt;Card.Content&gt;</code>, the card automatically fills 100% of its parent bounding box and configures flex box layout for child elements.
                          </p>
                          <div style={{ flex: 1, background: 'var(--ai-bg-container)', borderRadius: 'var(--ai-radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ai-text-secondary)', fontWeight: 600 }}>
                            Auto-Filling Bounding Box Area
                          </div>
                        </Card.Content>
                        <Card.Footer>
                          <span>Adaptive Status: Active</span>
                          <Card.Actions>
                            <Button size="sm" variant="outline" icon="✨" onClick={() => addToast({ type: 'info', message: 'Card Action button clicked!', priority: 'medium' })}>Action</Button>
                          </Card.Actions>
                        </Card.Footer>
                      </Card>

                      <Card layout="auto" style={{ height: '18rem' }}>
                        <Card.Header>Connected Toolbars & Groups (`&lt;UIGroup&gt;`)</Card.Header>
                        <Card.Content layout="auto" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>3-Button Connected Group with Glyphs</div>
                            <UIGroup>
                              <Button variant="outline" icon="◀" onClick={() => addToast({ type: 'info', message: 'Left toolbar button clicked!', priority: 'low' })}>Prev</Button>
                              <Button variant="outline" icon="●" onClick={() => addToast({ type: 'info', message: 'Center toolbar button clicked!', priority: 'low' })}>Pause</Button>
                              <Button variant="outline" icon="▶" onClick={() => addToast({ type: 'info', message: 'Right toolbar button clicked!', priority: 'low' })}>Next</Button>
                            </UIGroup>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Search Input Toolbar Group</div>
                            <UIGroup style={{ width: '100%' }}>
                              <Input placeholder="Search records..." style={{ width: '100%' }} />
                              <Button variant="primary" icon="🔍" onClick={() => addToast({ type: 'success', message: 'Search executed!', priority: 'high' })}>Search</Button>
                            </UIGroup>
                          </div>
                        </Card.Content>
                      </Card>
                    </Grid>

                    {/* Section 3: Radix UI Primitives */}
                    <Card>
                      <Card.Header>Radix UI Primitives (Accordion, Dropdown Menu, Tooltip & Slider)</Card.Header>
                      <Card.Content style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Contextual Action Menu (`&lt;DropdownMenu&gt;`)</div>
                            <DropdownMenu
                              trigger={<Button variant="outline" icon="⚙️" trailingIcon="▼">User Actions Menu</Button>}
                              items={[
                                { value: 'profile', label: 'View Profile', icon: '👤', onClick: () => addToast({ type: 'info', message: 'View Profile selected', priority: 'medium' }) },
                                { value: 'settings', label: 'Account Settings', icon: '⚙️', onClick: () => addToast({ type: 'info', message: 'Settings selected', priority: 'low' }) },
                                { isSeparator: true, value: 'sep1', label: '' },
                                { value: 'logout', label: 'Log Out', icon: '🚪', onClick: () => addToast({ type: 'warning', message: 'User logged out', priority: 'high' }) },
                              ]}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Hover Tooltip (`&lt;Tooltip&gt;`)</div>
                            <Tooltip content="Radix UI Accessible Tooltip with HSV Styling">
                              <Button variant="secondary" icon="ℹ️">Hover For Tooltip</Button>
                            </Tooltip>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Interactive Range Slider (`&lt;Slider&gt;`)</div>
                            <Slider defaultValue={65} onChange={val => addToast({ type: 'info', message: `Slider value changed to ${val}%`, priority: 'low' })} />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ai-text-secondary)', marginBottom: '0.375rem' }}>Expandable Accordion (`&lt;Accordion&gt;`)</div>
                          <Accordion
                            defaultValue="faq-1"
                            items={[
                              { value: 'faq-1', title: 'Why use Radix UI Primitives?', content: 'Radix UI primitives handle WAI-ARIA roles, focus trapping, keyboard navigation, and light-dismiss while AI-UI handles slots, HSV theming, and event bus dispatching.' },
                              { value: 'faq-2', title: 'How does Event Bus integration work?', content: 'Every primitive action automatically emits strongly-typed events to aiBus (e.g. accordion:opened, menu:item_selected, slider:changed).' },
                            ]}
                          />
                        </div>
                      </Card.Content>
                    </Card>
                  </VStack>
                )}
              </div>
            </div>
          </Splitter.Panel>

          {/* Bottom Panel: Live Event Bus Monitor */}
          <Splitter.Panel squareCorners="top">
            <Card squareCorners="top" style={{ margin: 0, height: '100%', border: '0.0625rem solid var(--ai-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Card.Header style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                <Toolbar>
                  <Toolbar.Left>
                    <span>⚡ Live AI Event Bus Monitor (`aiBus` Stream)</span>
                  </Toolbar.Left>
                  <Toolbar.Right>
                    <Tooltip content="Clear all recorded event log items from stream">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="🗑️"
                        onClick={() => {
                          setEventLogs([]);
                          aiBus.emit('log:cleared', { timestamp: new Date().toLocaleTimeString() });
                        }}
                      >
                        Clear Log
                      </Button>
                    </Tooltip>
                  </Toolbar.Right>
                </Toolbar>
              </Card.Header>
              <Card.Content style={{ padding: '0.5rem 1rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#111827', color: '#10b981', padding: '0.5rem 0.75rem', borderRadius: 'var(--ai-radius-md, 0.375rem)', fontFamily: 'monospace', fontSize: '0.8rem', height: '100%', overflowY: 'auto' }}>
                  {eventLogs.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Listening for events on aiBus... (Drag the separator bar to resize)</div>
                  ) : (
                    eventLogs.map(log => (
                      <div key={log.id} style={{ marginBottom: '0.2rem' }}>
                        <span style={{ color: '#6b7280' }}>[{log.time}]</span>{' '}
                        <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{log.event}</span>:{' '}
                        <span style={{ color: '#f3f4f6' }}>{log.payload}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card.Content>
            </Card>
          </Splitter.Panel>
        </Splitter>
      </main>
    </div>
  );
};

export default App;
