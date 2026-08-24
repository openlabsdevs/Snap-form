import {
    createSlice,
    createSelector,
    type PayloadAction,
} from "@reduxjs/toolkit";
import { FormDefinitionSchema, type FormElement, type FormDefinition, type FormElementType } from "@repo/types";
import type { RootState } from "../store";

export type FormType = "SCROLL" | "STEP" | "CHAT";

// Distribute across union members so element-specific props (placeholder, options, max, rows, etc.) are preserved
type DistributivePatch<T, K extends keyof any> = T extends any
    ? Partial<Omit<T, K>>
    : never;

export type SnippetPatch = DistributivePatch<FormElement, "id" | "type">;

const ELEMENT_KEYS: Record<FormElementType, ReadonlySet<string>> = {
    textInput: new Set(["label", "description", "required", "placeholder", "maxLength"]),
    textarea: new Set(["label", "description", "required", "placeholder", "rows", "maxLength"]),
    rating: new Set(["label", "description", "required", "max"]),
    multipleChoice: new Set(["label", "description", "required", "options"]),
    checkbox: new Set(["label", "description", "required", "options"]),
    dropdown: new Set(["label", "description", "required", "placeholder", "options"]),
    email: new Set(["label", "description", "required", "placeholder"]),
    phone: new Set(["label", "description", "required", "placeholder"]),
    datePicker: new Set(["label", "description", "required", "minDate", "maxDate"]),
    heading: new Set(["label", "description", "level"]),
    paragraph: new Set(["label", "description"]),
};


export interface BuilderHistorySnapshot {
    snippets: FormElement[];
    selectedSnippetId: string | null;
    formTitle: string;
    formType: FormType;
    isDirty: boolean;
}


export interface BuilderState {
    snippets: FormElement[];
    selectedSnippetId: string | null;
    formTitle: string;
    formType: FormType;
    isDirty: boolean;
    past: BuilderHistorySnapshot[];
    future: BuilderHistorySnapshot[];
}

const MAX_HISTORY_LIMIT = 30;

const initialState: BuilderState = {
    snippets: [],
    selectedSnippetId: null,
    formTitle: "Untitled Form",
    formType: "SCROLL",
    isDirty: false,
    past: [],
    future: [],
};

const takeSnapshot = (state: BuilderState): BuilderHistorySnapshot => ({
    snippets: JSON.parse(JSON.stringify(state.snippets)),
    selectedSnippetId: state.selectedSnippetId,
    formTitle: state.formTitle,
    formType: state.formType,
    isDirty: state.isDirty,
});

const recordHistory = (state: BuilderState) => {
    state.past.push(takeSnapshot(state));
    if (state.past.length > MAX_HISTORY_LIMIT) {
        state.past.shift();
    }
    state.future = [];
    state.isDirty = true;
};

export const builderSlice = createSlice({
    name: "builder",
    initialState,
    reducers: {
        addSnippet: (
            state,
            action: PayloadAction<{ snippet: FormElement; index?: number }>
        ) => {
            recordHistory(state);
            const { snippet, index } = action.payload;
            if (
                typeof index === "number" &&
                index >= 0 &&
                index <= state.snippets.length
            ) {
                state.snippets.splice(index, 0, snippet);
            } else {
                state.snippets.push(snippet);
            }
            state.selectedSnippetId = snippet.id;
        },

        removeSnippet: (state, action: PayloadAction<string>) => {
            const id = action.payload;
            const index = state.snippets.findIndex((s) => s.id === id);
            if (index !== -1) {
                recordHistory(state);
                state.snippets.splice(index, 1);
                if (state.selectedSnippetId === id) {
                    state.selectedSnippetId = null;
                }
            }
        },

        reorderSnippets: (
            state,
            action: PayloadAction<{ sourceIndex: number; destinationIndex: number }>
        ) => {
            const { sourceIndex, destinationIndex } = action.payload;
            if (
                sourceIndex >= 0 &&
                sourceIndex < state.snippets.length &&
                destinationIndex >= 0 &&
                destinationIndex < state.snippets.length &&
                sourceIndex !== destinationIndex
            ) {
                recordHistory(state);
                const [moved] = state.snippets.splice(sourceIndex, 1);
                if (moved) {
                    state.snippets.splice(destinationIndex, 0, moved);
                }
            }
        },

        /**
         * Apply a partial config patch to a snippet.
         *
         * `recordHistory` controls how the edit is treated in the history engine:
         *
         * - `true` (default) — a full undo snapshot is pushed before the patch is applied.
         *   Use for discrete, intentional edits (e.g. toggling required, selecting a type).
         *
         * - `false` — no snapshot is pushed, so the edit is not individually undoable.
         *   The form is still marked dirty and stale redo history is cleared, because the
         *   content has genuinely changed. Use for continuous-input scenarios (e.g. typing
         *   in a label field) to avoid flooding the undo stack on every keystroke.
         *
         * Note: a future `ephemeral` mode (no dirty flag, no redo-clear) may be added for
         * transient UI states such as drag-ghost previews or hover highlights.
         */
        updateSnippetConfig: (
            state,
            action: PayloadAction<{
                id: string;
                patch: SnippetPatch;
                /** See reducer JSDoc for semantics. Defaults to `true`. */
                recordHistory?: boolean;
            }>
        ) => {
            const { id, patch, recordHistory: shouldRecord = true } = action.payload;
            const index = state.snippets.findIndex((s) => s.id === id);
            if (index === -1) return;

            const element = state.snippets[index]!;
            const allowed = ELEMENT_KEYS[element.type];

            // Filter to only keys valid for this element type; drop undefined values
            const filteredPatch = Object.fromEntries(
                Object.entries(patch).filter(
                    ([key, val]) => allowed.has(key) && val !== undefined
                )
            );

            // True no-op: nothing valid to apply — don't touch history or dirty flag
            if (Object.keys(filteredPatch).length === 0) return;

            if (shouldRecord) {
                recordHistory(state);
            } else {
                state.future = [];
                state.isDirty = true;
            }
            state.snippets[index] = { ...element, ...filteredPatch } as FormElement;

        },

        setSelectedSnippet: (state, action: PayloadAction<string | null>) => {
            state.selectedSnippetId = action.payload;
        },

        setFormTitle: (state, action: PayloadAction<string>) => {
            if (state.formTitle !== action.payload) {
                recordHistory(state);
                state.formTitle = action.payload;
            }
        },

        setFormType: (state, action: PayloadAction<FormType>) => {
            if (state.formType !== action.payload) {
                recordHistory(state);
                state.formType = action.payload;
            }
        },

        loadForm: (
            state,
            action: PayloadAction<{
                snippets: FormElement[];
                formTitle?: string;
                formType?: FormType;
                selectedSnippetId?: string | null;
            }>
        ) => {
            state.snippets = action.payload.snippets;
            state.formTitle = action.payload.formTitle ?? "Untitled Form";
            state.formType = action.payload.formType ?? "SCROLL";
            state.selectedSnippetId = action.payload.selectedSnippetId ?? null;
            state.isDirty = false;
            state.past = [];
            state.future = [];
        },

        markClean: (state) => {
            state.isDirty = false;
        },

        resetBuilder: () => initialState,

        undo: (state) => {
            const previous = state.past.pop();
            if (previous) {
                state.future.unshift(takeSnapshot(state));
                state.snippets = previous.snippets;
                state.selectedSnippetId = previous.selectedSnippetId;
                state.formTitle = previous.formTitle;
                state.formType = previous.formType;
                state.isDirty = previous.isDirty;
            }
        },


        redo: (state) => {
            const next = state.future.shift();
            if (next) {
                state.past.push(takeSnapshot(state));
                state.snippets = next.snippets;
                state.selectedSnippetId = next.selectedSnippetId;
                state.formTitle = next.formTitle;
                state.formType = next.formType;
                state.isDirty = next.isDirty;
            }
        },

    },
});

export const {
    addSnippet,
    removeSnippet,
    reorderSnippets,
    updateSnippetConfig,
    setSelectedSnippet,
    setFormTitle,
    setFormType,
    loadForm,
    markClean,
    resetBuilder,
    undo,
    redo,
} = builderSlice.actions;

export const builderReducer = builderSlice.reducer;

// Base Selectors
export const selectBuilderState = (state: RootState) => state.builder;
export const selectSnippets = (state: RootState) => state.builder.snippets;
export const selectSelectedSnippetId = (state: RootState) =>
    state.builder.selectedSnippetId;
export const selectFormTitle = (state: RootState) => state.builder.formTitle;
export const selectFormType = (state: RootState) => state.builder.formType;
export const selectIsDirty = (state: RootState) => state.builder.isDirty;
export const selectCanUndo = (state: RootState) => state.builder.past.length > 0;
export const selectCanRedo = (state: RootState) =>
    state.builder.future.length > 0;

// Memoized Selectors
export const selectSelectedSnippet = createSelector(
    [selectSnippets, selectSelectedSnippetId],
    (snippets, selectedId) => snippets.find((s) => s.id === selectedId) ?? null
);

const _selectFormParseResult = createSelector([selectSnippets], (snippets) =>
    FormDefinitionSchema.safeParse({ version: "1.0", elements: snippets })
);

// Returns a fully Zod-normalized FormDefinition (defaults filled, unknowns stripped),
// or null when the current canvas state is invalid mid-edit.
export const selectFormDefinition = createSelector(
    [_selectFormParseResult],
    (result): FormDefinition | null => (result.success ? result.data : null)
);

// Returns Zod validation issues for inline UI feedback, or null when valid.
export const selectFormValidationErrors = createSelector(
    [_selectFormParseResult],
    (result) => (!result.success ? result.error.issues : null)
);
