# Issue: Convert remaining Japanese comments to English

**Title:** refactor: Convert remaining Japanese comments to English
**Labels:** refactoring, internationalization, good first issue
**Assignees:** (留空)

## 📋 Overview

There are still Japanese comments remaining in the codebase that need to be converted to English to improve code accessibility for international contributors and maintain consistency with the recent refactoring work completed in commit `96d4e2e`.

## 🎯 Objective

Convert all remaining Japanese inline comments (`//`) and JSDoc comments to English while maintaining code functionality and readability.

## 📍 Affected Files

Based on recent analysis, the following files still contain Japanese comments:

- `src/cli/index.ts`
  - Line ~139: `// 結果が数値データの場合、簡単なチャートを表示`
  - Line ~160: `// 通常の実行（高い信頼度の場合）`

- `src/utils/config.ts`
  - Line ~18: `// ユーザー設定を優先して読み込み`
  - Line ~26: `// デフォルト設定を読み込み`

- `src/services/stepExecutionService.ts`
  - Line ~158: JSDoc comment: `ユーザーアクションを取得`
  - Line ~133: JSDoc comment: `クエリの概要を表示`
  - Line ~425: `// 編集方法の選択`

## ✅ Acceptance Criteria

- [ ] All Japanese inline comments (`//`) are converted to English
- [ ] All Japanese JSDoc comments (`/** */`) are converted to English
- [ ] Code functionality remains unchanged
- [ ] All existing tests continue to pass (91/91 tests should pass)
- [ ] Comments are grammatically correct and maintain technical accuracy
- [ ] Commit message follows conventional commit format

## 🔍 How to Find Target Comments

Use the following command to find remaining Japanese comments:

```bash
grep -r -n "[あ-ん]|[ア-ン]|[一-龯]" src/ --include="*.ts"
```

## 📝 Translation Guidelines

### Common Translations

- `結果が数値データの場合、簡単なチャートを表示` → `Display simple chart for numeric data results`
- `通常の実行（高い信頼度の場合）` → `Normal execution (high confidence case)`
- `ユーザー設定を優先して読み込み` → `Load user settings with priority`
- `デフォルト設定を読み込み` → `Load default settings`
- `ユーザーアクションを取得` → `Get user action`
- `クエリの概要を表示` → `Display query summary`
- `編集方法の選択` → `Select edit method`

### Style Guidelines

- Use concise, clear English
- Maintain technical accuracy
- Follow existing English comment patterns in the codebase
- Use imperative mood for action comments (e.g., "Load settings" not "Loading settings")

## 🧪 Testing

After making changes, verify that:

```bash
# Run linting
npm run lint

# Run all tests
npm test

# Check for remaining Japanese comments
grep -r -n "[あ-ん]|[ア-ン]|[一-龯]" src/ --include="*.ts" || echo "All comments converted!"
```

## 📚 Related Work

This issue builds upon the previous refactoring work completed in commit `96d4e2e` which converted most Japanese comments to English. This task focuses on completing the remaining translations that were missed in the initial pass.

## 💡 Additional Notes

- This is marked as a "good first issue" as it provides an opportunity to familiarize yourself with the codebase
- Focus on maintaining the same meaning and technical context when translating
- If unsure about technical terminology, refer to existing English comments in the codebase for consistency
- The project maintains 91/91 test coverage, ensure all tests continue to pass

---

## Instructions for Creating the Issue

1. Go to the [GitHub Issues page](https://github.com/georgeOsdDev/AppInsightsDetective/issues)
2. Click "New Issue"
3. Copy and paste the above content
4. Set the title as: `refactor: Convert remaining Japanese comments to English`
5. Add labels: `refactoring`, `internationalization`, `good first issue`
6. Submit the issue
