# Code Protection Guide

## ✅ Already Implemented

1. **Legal Protection**
   - ✅ LICENSE file (Proprietary "All Rights Reserved")
   - ✅ package.json license field
   - ✅ README license notice
   - ✅ Copyright and license notices in the repository

2. **Build Protection**
   - ✅ Sourcemaps disabled in production
   - ✅ Minification enabled
   - ✅ Next.js production build

## 🔒 Additional Protection Measures

### 1. **Code Obfuscation (Optional - Advanced)**

Next.js minifies production client bundles and disables browser source maps by
default. Code shipped to browsers remains inspectable; keep secrets and private
logic on the server. Vite plugins are not part of this project's build.

### 2. **Server-Side Validation**

- Add API endpoints for critical operations
- Validate requests server-side
- Use authentication tokens for sensitive features
- Rate limit API calls

### 3. **Domain/Environment Checks**

Add checks in your code to prevent running on unauthorized domains:

```javascript
// In your App.tsx
const allowedDomains = ['infinitespecies.com', 'localhost'];
if (!allowedDomains.includes(window.location.hostname)) {
  console.error('Unauthorized domain');
  // Optionally redirect or disable functionality
}
```

### 4. **Terms of Service**

Create a Terms of Service page that:
- Prohibits reverse engineering
- Prohibits copying/distributing code
- States proprietary nature
- Links from your website footer

### 5. **Monitoring & Detection**

- Monitor for unauthorized copies of your site
- Use Google Alerts for your unique code snippets
- Set up web monitoring services
- Check GitHub/GitLab for copies of your code

### 6. **Watermarking**

- Add hidden watermarks in your code
- Include unique identifiers
- Track usage analytics

### 7. **Legal Actions**

If you find unauthorized copies:
- Send DMCA takedown notices
- Contact hosting providers
- Consult with an attorney for legal action

## ⚠️ Important Notes

**For Client-Side Web Apps:**
- Code will ALWAYS be visible in the browser
- Minification/obfuscation only makes it harder, not impossible
- Focus on legal protection (LICENSE) as primary defense
- Consider server-side features for critical functionality

**Best Practices:**
- Keep sensitive logic server-side when possible
- Use API keys that can be revoked
- Monitor for unauthorized usage
- Document your proprietary rights clearly

## 📝 Recommended Next Steps

1. ✅ **Done**: Legal protection (LICENSE, package.json, README)
2. ✅ **Done**: Build protection (no sourcemaps, minification)
3. **Consider**: Add Terms of Service page
4. **Consider**: Add domain validation
5. **Consider**: Set up monitoring for code theft
6. **Consider**: Move critical features to server-side APIs
